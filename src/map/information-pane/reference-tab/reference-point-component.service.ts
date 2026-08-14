import { inject, Injectable, OnDestroy } from '@angular/core';
import Graphic from '@arcgis/core/Graphic';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer';
import SketchViewModel from '@arcgis/core/widgets/Sketch/SketchViewModel';
import Point from '@arcgis/core/geometry/Point';
import { ReferencePointComponentStore } from './reference-point-component.store';
import { ReferencePointSaveError, ReferencePointLoadError } from './reference-point-errors';
import { ReferencePoint, ReferencePointType, AttributeValue, generateClientId } from './reference-point-types';
import { REF_POINT_SYMBOLS, REF_POINT_ADDING_SYMBOL } from './reference-point-config';
import {
  findRelationshipId,
  findRelatedLayer,
  resolveEditableFields,
  queryRelatedPoints,
} from './reference-point-resolution';
import { applyPointEdits } from './reference-point-helpers';
import { REF_POINT_TYPE_FIELD, REF_POINT_LAYER_NAME } from '../../map-config';
import { ViewStore } from '../../view/view.store';
import { ViewService } from '../../view/view.service';
import { HistoryStore } from '../../history/history.store';
import { RIMA_SPATIAL_REFERENCE_LV95_EPSG, RIMA_SWITZERLAND_EXTENT } from '../../map-constants';
import { buildSnappingSources, cleanupSketchResources } from '../../shared/sketch-utils';
import { LayerIdResolver } from '../../layer/layer-id-resolver';

@Injectable()
export class ReferencePointComponentService implements OnDestroy {
  private readonly store = inject(ReferencePointComponentStore);
  private readonly viewStore = inject(ViewStore);
  private readonly viewService = inject(ViewService);
  private readonly historyStore = inject(HistoryStore);
  private readonly layerIdResolver = inject(LayerIdResolver);

  private displayLayer: GraphicsLayer | undefined;
  private highlightLayer: GraphicsLayer | undefined;
  private sketchViewModel: SketchViewModel | undefined;
  private sketchLayer: GraphicsLayer | undefined;
  private eventHandle: { remove(): void } | undefined;
  private highlightedGraphics = new Map<string, Graphic>();

  ngOnDestroy(): void {
    this.cleanup();
  }

  // --- Resolution & Loading ---

  resolveAndLoad(graphic: Graphic): void {
    const layer = graphic.layer;
    if (!(layer instanceof FeatureLayer)) return;

    this.resolve(layer);
    this.loadPoints(layer, graphic);
  }

  resolveForCreate(layer: FeatureLayer): void {
    this.resolve(layer);
  }

  resolveAndLoadForView(graphic: Graphic): void {
    const layer = graphic.layer;
    if (!(layer instanceof FeatureLayer)) return;

    this.resolve(layer);
    this.loadPointsForView(layer, graphic);
  }

  // --- Adding ---

  startAdding(): void {
    this.store.startAdding();
  }

  startPlacingOnMap(): void {
    const view = this.viewService.activeView();
    if (!view?.map) return;

    this.cleanupSketch();

    this.sketchLayer = new GraphicsLayer({ listMode: 'hide' });
    view.map.add(this.sketchLayer);

    this.sketchViewModel = new SketchViewModel({
      view,
      layer: this.sketchLayer,
      pointSymbol: REF_POINT_ADDING_SYMBOL,
      snappingOptions: {
        enabled: true,
        featureSources: buildSnappingSources(view.map),
      },
    });

    this.eventHandle = this.sketchViewModel.on('create', (event) => {
      if (event.state === 'complete' && event.graphic?.geometry) {
        const point = event.graphic.geometry as Point;
        this.store.setAddingGeometry(point);
        this.viewStore.setSketchActive(false);
        this.cleanupSketch();
      }
    });

    this.sketchViewModel.create('point');
    this.viewStore.setSketchActive(true);
  }

  setAddingGeometryFromCoordinates(x: number, y: number): boolean {
    const extent = RIMA_SWITZERLAND_EXTENT;
    if (x < extent.xmin || x > extent.xmax || y < extent.ymin || y > extent.ymax) {
      return false;
    }

    const point = new Point({
      x,
      y,
      spatialReference: { wkid: RIMA_SPATIAL_REFERENCE_LV95_EPSG },
    });

    this.store.setAddingGeometry(point);
    return true;
  }

  confirmAdd(): boolean {
    const geometry = this.store.addingGeometry();
    if (!geometry) return false;

    const addingAttrs = this.store.addingAttributes();
    const selectedType = addingAttrs[REF_POINT_TYPE_FIELD] as ReferencePointType | undefined;

    // Cardinality check: max 1 von and max 1 bis
    if (selectedType === 'von' && !this.store.canAddVon()) return false;
    if (selectedType === 'bis' && !this.store.canAddBis()) return false;

    const newPoint: ReferencePoint = {
      clientId: generateClientId(),
      type: selectedType,
      objectId: undefined,
      globalId: undefined,
      geometry,
      attributes: { ...addingAttrs },
      isNew: true,
      isModified: false,
    };

    this.store.addPoint(newPoint);
    this.store.cancelAdding();
    this.refreshDisplayLayer();
    return true;
  }

  cancelAdd(): void {
    this.cleanupSketch();
    this.viewStore.setSketchActive(false);
    this.store.cancelAdding();
    this.refreshDisplayLayer();
  }

  // --- Editing ---

  startEditingPoint(clientId: string): void {
    this.store.setActiveEdit(clientId);
  }

  startEditingPointGeometry(clientId: string): void {
    const point = this.store.points().find((p) => p.clientId === clientId);
    if (!point?.geometry) return;

    const view = this.viewService.activeView();
    if (!view?.map) return;

    this.cleanupSketch();

    this.sketchLayer = new GraphicsLayer({ listMode: 'hide' });
    view.map.add(this.sketchLayer);

    const graphic = new Graphic({
      geometry: point.geometry.clone(),
      symbol: REF_POINT_ADDING_SYMBOL,
    });
    this.sketchLayer.add(graphic);

    this.sketchViewModel = new SketchViewModel({
      view,
      layer: this.sketchLayer,
      updateOnGraphicClick: false,
      snappingOptions: {
        enabled: true,
        featureSources: buildSnappingSources(view.map),
      },
    });

    this.eventHandle = this.sketchViewModel.on('update', (event) => {
      if (event.state === 'active' || event.state === 'complete') {
        const updatedGeometry = event.graphics[0]?.geometry as Point;
        if (updatedGeometry) {
          this.store.updatePoint(clientId, {
            geometry: updatedGeometry,
            isModified: !point.isNew,
          });
        }
      }
      if (event.state === 'complete') {
        this.cleanupSketch();
        this.viewStore.setSketchActive(false);
        this.refreshDisplayLayer();
      }
    });

    this.sketchViewModel.update(graphic, { tool: 'move' });
    this.viewStore.setSketchActive(true);
  }

  updatePointAttribute(clientId: string, fieldName: string, value: AttributeValue): boolean {
    const point = this.store.points().find((p) => p.clientId === clientId);
    if (!point) return false;

    const updates: Partial<ReferencePoint> = {
      attributes: { ...point.attributes, [fieldName]: value },
      isModified: !point.isNew,
    };

    if (fieldName === REF_POINT_TYPE_FIELD) {
      const newType = value === 'von' || value === 'bis' ? value : undefined;
      // Reject if another point already has this type
      if (newType && this.store.points().some((p) => p.clientId !== clientId && p.type === newType)) {
        return false;
      }
      updates.type = newType;
    }

    this.store.updatePoint(clientId, updates);
    return true;
  }

  confirmEditPoint(): void {
    this.cleanupSketch();
    this.viewStore.setSketchActive(false);
    this.store.setActiveEdit(undefined);
    this.refreshDisplayLayer();
  }

  deletePoint(clientId: string): void {
    this.store.removePoint(clientId);
    this.refreshDisplayLayer();
  }

  // --- Save ---

  async save(parentId: string, parentLayerId: number): Promise<void> {
    const relatedLayer = this.store.relatedLayer();
    if (!relatedLayer) return;

    const parentLayerName = this.layerIdResolver.resolveName(parentLayerId);
    this.viewStore.setSaving(true);
    try {
      await applyPointEdits(
        relatedLayer,
        this.store.points(),
        this.store.deletedObjectIds(),
        parentId,
        parentLayerName,
      );
      this.store.markSaved();
      this.viewStore.setSaving(false);
    } catch (error) {
      this.viewStore.setSaving(false);
      throw new ReferencePointSaveError(error);
    }
  }

  // --- Highlight (view mode) ---

  highlightPoint(point: ReferencePoint): void {
    this.ensureHighlightLayer();
    const symbol = point.type ? REF_POINT_SYMBOLS[point.type] : REF_POINT_ADDING_SYMBOL;
    const graphic = new Graphic({
      geometry: point.geometry ?? undefined,
      symbol,
    });
    this.highlightLayer!.add(graphic);
    this.highlightedGraphics.set(point.clientId, graphic);
    this.store.setHighlightedIds([...this.highlightedGraphics.keys()]);
  }

  unhighlightPoint(clientId: string): void {
    const graphic = this.highlightedGraphics.get(clientId);
    if (graphic) {
      this.highlightLayer?.remove(graphic);
      this.highlightedGraphics.delete(clientId);
      this.store.setHighlightedIds([...this.highlightedGraphics.keys()]);
    }
  }

  toggleHighlight(point: ReferencePoint): void {
    if (this.highlightedGraphics.has(point.clientId)) {
      this.unhighlightPoint(point.clientId);
    } else {
      this.highlightPoint(point);
    }
  }

  toggleAllHighlights(): void {
    const points = this.store.points();
    const allHighlighted = points.length > 0 && points.every((p) => this.highlightedGraphics.has(p.clientId));

    if (allHighlighted) {
      this.clearHighlights();
    } else {
      for (const point of points) {
        if (!this.highlightedGraphics.has(point.clientId)) {
          this.highlightPoint(point);
        }
      }
    }
  }

  // --- Display Layer (edit mode) ---

  toggleDisplay(): void {
    const visible = !this.store.displayVisible();
    this.store.setDisplayVisible(visible);
    if (visible) {
      this.refreshDisplayLayer();
    } else {
      this.removeDisplayLayer();
    }
  }

  togglePointVisibility(clientId: string): void {
    this.store.togglePointHidden(clientId);
    this.refreshDisplayLayer();
  }

  refreshDisplayLayer(): void {
    const view = this.viewService.activeView();
    if (!view?.map) return;

    if (!this.store.displayVisible()) {
      this.removeDisplayLayer();
      return;
    }

    const hiddenIds = this.store.hiddenPointIds();
    const graphics = this.store
      .points()
      .filter((p) => p.geometry && !hiddenIds.includes(p.clientId))
      .map((p) => {
        const symbol = p.type ? REF_POINT_SYMBOLS[p.type] : REF_POINT_ADDING_SYMBOL;
        return new Graphic({ geometry: p.geometry, symbol });
      });

    if (this.store.isAdding()) {
      const addingGeometry = this.store.addingGeometry();
      if (addingGeometry) {
        graphics.push(new Graphic({ geometry: addingGeometry, symbol: REF_POINT_ADDING_SYMBOL }));
      }
    }

    if (!this.displayLayer) {
      this.displayLayer = new GraphicsLayer({ listMode: 'hide', title: 'Referenzpunkte' });
      view.map.add(this.displayLayer);
    }

    this.displayLayer.removeAll();
    this.displayLayer.addMany(graphics);
  }

  // --- Cleanup ---

  cleanup(): void {
    this.cleanupSketch();
    this.clearHighlights();
    this.removeDisplayLayer();
  }

  // --- Private ---

  private resolve(layer: FeatureLayer): void {
    const view = this.viewService.activeView();
    const refPointLayerId = this.layerIdResolver.resolveId(REF_POINT_LAYER_NAME);
    const relationshipId = findRelationshipId(layer, refPointLayerId);
    const relatedLayer = view && relationshipId != null ? findRelatedLayer(view, refPointLayerId) : undefined;
    const fields = relatedLayer ? resolveEditableFields(relatedLayer) : [];
    this.store.setup(relationshipId, relatedLayer, fields);
  }

  private async loadPoints(layer: FeatureLayer, graphic: Graphic): Promise<void> {
    const relationshipId = this.store.relationshipId();
    const relatedLayer = this.store.relatedLayer();
    if (relationshipId == null || !relatedLayer) return;

    this.store.setLoading(true);
    try {
      const points = await queryRelatedPoints(layer, graphic, relationshipId, relatedLayer);
      this.store.setPoints(points);
      this.store.setLoading(false);
      this.refreshDisplayLayer();
    } catch (error) {
      this.store.setLoading(false);
      throw new ReferencePointLoadError(error);
    }
  }

  private async loadPointsForView(layer: FeatureLayer, graphic: Graphic): Promise<void> {
    const relationshipId = this.store.relationshipId();
    const relatedLayer = this.store.relatedLayer();
    if (relationshipId == null || !relatedLayer) return;

    this.store.setLoading(true);
    try {
      const historicMoment = this.historyStore.selectedDate() ?? undefined;
      const points = await queryRelatedPoints(layer, graphic, relationshipId, relatedLayer, historicMoment);
      this.store.setPoints(points);
      this.store.setLoading(false);
    } catch (error) {
      this.store.setLoading(false);
      throw new ReferencePointLoadError(error);
    }
  }

  private cleanupSketch(): void {
    this.eventHandle?.remove();
    this.eventHandle = undefined;

    const view = this.viewService.activeView();
    const cleaned = cleanupSketchResources(this.sketchViewModel, this.sketchLayer, view);
    this.sketchViewModel = cleaned.sketchViewModel;
    this.sketchLayer = cleaned.sketchLayer;
  }

  private removeDisplayLayer(): void {
    const view = this.viewService.activeView();
    if (this.displayLayer && view?.map) {
      view.map.remove(this.displayLayer);
      this.displayLayer.destroy();
    }
    this.displayLayer = undefined;
  }

  private clearHighlights(): void {
    for (const graphic of this.highlightedGraphics.values()) {
      this.highlightLayer?.remove(graphic);
    }
    this.highlightedGraphics.clear();
    this.store.setHighlightedIds([]);
  }

  private ensureHighlightLayer(): void {
    if (this.highlightLayer) return;
    const view = this.viewService.activeView();
    if (!view?.map) return;
    this.highlightLayer = new GraphicsLayer({ title: 'Reference Point Highlights', listMode: 'hide' });
    view.map.add(this.highlightLayer);
  }
}
