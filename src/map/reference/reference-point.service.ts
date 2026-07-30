import { inject, Injectable } from '@angular/core';
import Graphic from '@arcgis/core/Graphic';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer';
import SketchViewModel from '@arcgis/core/widgets/Sketch/SketchViewModel';
import Point from '@arcgis/core/geometry/Point';
import { ReferencePointSaveError, ReferencePointLoadError } from './reference-point-errors';
import { ReferencePoint, ReferencePointType, AttributeValue, generateClientId } from './reference-point-types';
import { REFERENCE_POINT_TYPES, REF_POINT_TYPE_CONFIGS, REF_POINT_ADDING_SYMBOL } from './reference-point-config';
import {
  findRelationshipId,
  findRelatedLayer,
  resolveEditableFields,
  queryRelatedPoints,
} from './reference-point-resolution';
import { applyPointEdits } from './reference-point-helpers';
import { buildSnappingSources, cleanupSketchResources } from '../shared/sketch-utils';
import { RIMA_SPATIAL_REFERENCE_LV95_EPSG, RIMA_SWITZERLAND_EXTENT } from '../map-constants';
import { ReferencePointStore } from './reference-point.store';
import { MapViewService } from '../view/mapview/mapview.service';
import { HistoryStore } from '../history/history.store';

@Injectable({ providedIn: 'root' })
export class ReferencePointService {
  readonly store = inject(ReferencePointStore);
  private readonly viewService = inject(MapViewService);
  private readonly historyStore = inject(HistoryStore);

  private displayLayers: Partial<Record<ReferencePointType, GraphicsLayer>> = {};
  private sketchViewModel: SketchViewModel | undefined;
  private sketchLayer: GraphicsLayer | undefined;
  private eventHandle: { remove(): void } | undefined;
  private highlightLayer: GraphicsLayer | undefined;

  // --- Lifecycle ---

  prepareForLayer(layer: FeatureLayer): void {
    const view = this.viewService.getMapView();
    for (const type of REFERENCE_POINT_TYPES) {
      const relationshipId = findRelationshipId(layer, type);
      const relatedLayer = view && relationshipId != null ? findRelatedLayer(view, type) : undefined;
      const fields = relatedLayer ? resolveEditableFields(relatedLayer) : [];
      this.store.forType(type).setup(relationshipId, relatedLayer, fields);
    }
  }

  async loadForFeature(graphic: Graphic): Promise<void> {
    const layer = graphic.layer;
    if (!(layer instanceof FeatureLayer)) return;

    this.prepareForLayer(layer);

    for (const type of REFERENCE_POINT_TYPES) {
      const typeStore = this.store.forType(type);
      const relationshipId = typeStore.relationshipId();
      const relatedLayer = typeStore.relatedLayer();
      if (relationshipId == null || !relatedLayer) continue;

      typeStore.setLoading(true);
      try {
        const points = await queryRelatedPoints(layer, graphic, relationshipId, relatedLayer);
        typeStore.setPoints(points);
        typeStore.setLoading(false);
        this.refreshDisplayLayer(type);
      } catch (error) {
        typeStore.setLoading(false);
        throw new ReferencePointLoadError(error);
      }
    }
  }

  // --- Adding ---

  startAdding(type: ReferencePointType): void {
    this.store.startAdding(type);
  }

  startPlacingOnMap(type: ReferencePointType): void {
    const view = this.viewService.getMapView();
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
        this.store.addingGeometry.set(point);
        this.store.sketchActive.set(false);
        this.cleanupSketch();
        this.refreshDisplayLayer(type);
      }
    });

    this.sketchViewModel.create('point');
    this.store.sketchActive.set(true);
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

    this.store.addingGeometry.set(point);
    return true;
  }

  confirmAdd(type: ReferencePointType): void {
    const geometry = this.store.addingGeometry();
    if (!geometry) return;

    const newPoint: ReferencePoint = {
      clientId: generateClientId(),
      objectId: undefined,
      globalId: undefined,
      geometry,
      attributes: { ...this.store.addingAttributes() },
      isNew: true,
      isModified: false,
    };

    this.store.forType(type).addPoint(newPoint);
    this.store.cancelAdding();
    this.refreshDisplayLayer(type);
  }

  cancelAdd(): void {
    const type = this.store.addingType();
    this.cleanupSketch();
    this.store.sketchActive.set(false);
    this.store.cancelAdding();
    if (type) this.refreshDisplayLayer(type);
  }

  // --- Editing ---

  startEditingPoint(type: ReferencePointType, clientId: string): void {
    this.store.setActiveEdit(type, clientId);
  }

  startEditingPointGeometry(type: ReferencePointType, clientId: string): void {
    const typeStore = this.store.forType(type);
    const point = typeStore.points().find((p) => p.clientId === clientId);
    if (!point?.geometry) return;

    const view = this.viewService.getMapView();
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
          typeStore.updatePoint(clientId, {
            geometry: updatedGeometry,
            isModified: !point.isNew,
          });
        }
      }
      if (event.state === 'complete') {
        this.cleanupSketch();
        this.store.sketchActive.set(false);
        this.refreshDisplayLayer(type);
      }
    });

    this.sketchViewModel.update(graphic, { tool: 'move' });
    this.store.sketchActive.set(true);
  }

  updatePointAttribute(type: ReferencePointType, clientId: string, fieldName: string, value: AttributeValue): void {
    const typeStore = this.store.forType(type);
    const point = typeStore.points().find((p) => p.clientId === clientId);
    if (!point) return;

    typeStore.updatePoint(clientId, {
      attributes: { ...point.attributes, [fieldName]: value },
      isModified: !point.isNew,
    });
  }

  confirmEditPoint(type: ReferencePointType): void {
    this.cleanupSketch();
    this.store.sketchActive.set(false);
    this.store.setActiveEdit(type, undefined);
    this.refreshDisplayLayer(type);
  }

  deletePoint(type: ReferencePointType, clientId: string): void {
    this.store.forType(type).removePoint(clientId);
    this.refreshDisplayLayer(type);
  }

  // --- Save ---

  async save(parentId: string, parentLayerId: number): Promise<void> {
    this.store.saving.set(true);
    try {
      for (const type of REFERENCE_POINT_TYPES) {
        const typeStore = this.store.forType(type);
        const relatedLayer = typeStore.relatedLayer();
        if (!relatedLayer) continue;

        await applyPointEdits(relatedLayer, typeStore.points(), typeStore.deletedObjectIds(), parentId, parentLayerId);
      }
      this.store.saving.set(false);
    } catch (error) {
      this.store.saving.set(false);
      throw new ReferencePointSaveError(error);
    }
  }

  // --- View / Highlight ---

  resolveForView(
    layer: FeatureLayer,
    type: ReferencePointType,
  ): { relationshipId: number; relatedLayer: FeatureLayer } | undefined {
    const view = this.viewService.getMapView();
    if (!view) return undefined;

    const relationshipId = findRelationshipId(layer, type);
    if (relationshipId == null) return undefined;

    const relatedLayer = findRelatedLayer(view, type);
    if (!relatedLayer) return undefined;

    return { relationshipId, relatedLayer };
  }

  async loadPoints(
    layer: FeatureLayer,
    graphic: Graphic,
    relationshipId: number,
    relatedLayer: FeatureLayer,
  ): Promise<ReferencePoint[]> {
    try {
      const historicMoment = this.historyStore.selectedDate() ?? undefined;
      return await queryRelatedPoints(layer, graphic, relationshipId, relatedLayer, historicMoment);
    } catch (error) {
      throw new ReferencePointLoadError(error);
    }
  }

  highlightPoint(point: ReferencePoint, type: ReferencePointType): Graphic {
    this.ensureHighlightLayer();

    const graphic = new Graphic({
      geometry: point.geometry ?? undefined,
      symbol: REF_POINT_TYPE_CONFIGS[type].symbol,
    });

    this.highlightLayer!.add(graphic);
    return graphic;
  }

  unhighlightPoint(graphic: Graphic): void {
    this.highlightLayer?.remove(graphic);
  }

  cleanupHighlights(): void {
    const view = this.viewService.getMapView();
    if (this.highlightLayer) {
      this.highlightLayer.removeAll();
      view?.map?.remove(this.highlightLayer);
      this.highlightLayer = undefined;
    }
  }

  // --- Cleanup ---

  cleanup(): void {
    this.cleanupSketch();
    this.cleanupHighlights();
    for (const type of REFERENCE_POINT_TYPES) {
      this.removeDisplayLayer(type);
    }
  }

  reset(): void {
    this.cleanup();
    this.store.reset();
  }

  // --- Display ---

  toggleDisplay(type: ReferencePointType): void {
    const typeStore = this.store.forType(type);
    const visible = !typeStore.displayVisible();
    typeStore.setDisplayVisible(visible);
    if (visible) {
      this.refreshDisplayLayer(type);
    } else {
      this.removeDisplayLayer(type);
    }
  }

  togglePointVisibility(type: ReferencePointType, clientId: string): void {
    this.store.forType(type).togglePointHidden(clientId);
    this.refreshDisplayLayer(type);
  }

  refreshDisplayLayer(type: ReferencePointType): void {
    const view = this.viewService.getMapView();
    if (!view?.map) return;

    const typeStore = this.store.forType(type);
    if (!typeStore.displayVisible()) {
      this.removeDisplayLayer(type);
      return;
    }

    const config = REF_POINT_TYPE_CONFIGS[type];
    const hiddenIds = typeStore.hiddenPointIds();
    const graphics = typeStore
      .points()
      .filter((p) => p.geometry && !hiddenIds.includes(p.clientId))
      .map((p) => new Graphic({ geometry: p.geometry, symbol: config.symbol }));

    if (this.store.addingType() === type) {
      const addingGeometry = this.store.addingGeometry();
      if (addingGeometry) {
        graphics.push(new Graphic({ geometry: addingGeometry, symbol: REF_POINT_ADDING_SYMBOL }));
      }
    }

    let displayLayer = this.displayLayers[type];
    if (!displayLayer) {
      displayLayer = new GraphicsLayer({ listMode: 'hide', title: config.displayTitle });
      this.displayLayers[type] = displayLayer;
      view.map.add(displayLayer);
    }

    displayLayer.removeAll();
    displayLayer.addMany(graphics);
  }

  // --- Private ---

  private cleanupSketch(): void {
    this.eventHandle?.remove();
    this.eventHandle = undefined;

    const view = this.viewService.getMapView();
    const cleaned = cleanupSketchResources(this.sketchViewModel, this.sketchLayer, view);
    this.sketchViewModel = cleaned.sketchViewModel;
    this.sketchLayer = cleaned.sketchLayer;
  }

  private removeDisplayLayer(type: ReferencePointType): void {
    const view = this.viewService.getMapView();
    const displayLayer = this.displayLayers[type];
    if (displayLayer && view?.map) {
      view.map.remove(displayLayer);
      displayLayer.destroy();
    }
    this.displayLayers[type] = undefined;
  }

  private ensureHighlightLayer(): void {
    if (this.highlightLayer) return;

    const view = this.viewService.getMapView();
    if (!view?.map) return;

    this.highlightLayer = new GraphicsLayer({ title: 'Reference Point Highlights', listMode: 'hide' });
    view.map.add(this.highlightLayer);
  }
}
