import { inject, Injectable } from '@angular/core';
import Graphic from '@arcgis/core/Graphic';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer';
import SketchViewModel from '@arcgis/core/widgets/Sketch/SketchViewModel';
import Point from '@arcgis/core/geometry/Point';
import SimpleMarkerSymbol from '@arcgis/core/symbols/SimpleMarkerSymbol';
import { ReferencePointSaveError, ReferencePointLoadError } from '../reference-point-errors';
import { ReferencePoint, AttributeValue } from '../reference-point-types';
import { REF_POINT_VON_SYMBOL } from '../reference-point-config';
import { resolveAllRelationships, queryRelatedPoints } from '../reference-point-resolution';
import { applyPointEdits } from '../reference-point-helpers';
import { buildSnappingSources, cleanupSketchResources } from '../../shared/sketch-utils';
import { RIMA_SPATIAL_REFERENCE_LV95_EPSG, RIMA_SWITZERLAND_EXTENT } from '../../map-constants';
import { VonPointStore } from './von-point.store';
import { MapViewService } from '../../view/mapview/mapview.service';

const ADDING_POINT_SYMBOL = new SimpleMarkerSymbol({
  style: 'diamond',
  color: [46, 204, 113, 0.9],
  size: 12,
  outline: { color: [255, 255, 255], width: 2 },
});

@Injectable({ providedIn: 'root' })
export class VonPointService {
  readonly store = inject(VonPointStore);
  private readonly viewService = inject(MapViewService);

  private displayLayer: GraphicsLayer | undefined;
  private sketchViewModel: SketchViewModel | undefined;
  private sketchLayer: GraphicsLayer | undefined;
  private eventHandle: { remove(): void } | undefined;

  // --- Lifecycle ---

  initializeForLayer(layer: FeatureLayer): void {
    const view = this.viewService.getMapView();
    const relationships = resolveAllRelationships(layer, view);
    const relationship = relationships.find((r) => r.type === 'von');
    this.store.initialize(relationship);
  }

  async loadForFeature(graphic: Graphic): Promise<void> {
    const layer = graphic.layer;
    if (!(layer instanceof FeatureLayer)) return;

    const view = this.viewService.getMapView();
    const relationships = resolveAllRelationships(layer, view);
    const relationship = relationships.find((r) => r.type === 'von');
    this.store.initialize(relationship);

    if (!relationship) return;

    this.store.setLoading(true);
    try {
      const points = await queryRelatedPoints(layer, graphic, relationship.relationshipId);
      this.store.setPoints(points);
      this.store.setLoading(false);
      this.refreshDisplayLayer();
    } catch (error) {
      this.store.setLoading(false);
      throw new ReferencePointLoadError(error);
    }
  }

  // --- Adding ---

  startAdding(): void {
    this.store.startAdding();
  }

  startPlacingOnMap(): void {
    const view = this.viewService.getMapView();
    if (!view?.map) return;

    this.cleanupSketch();

    this.sketchLayer = new GraphicsLayer({ listMode: 'hide' });
    view.map.add(this.sketchLayer);

    this.sketchViewModel = new SketchViewModel({
      view,
      layer: this.sketchLayer,
      pointSymbol: ADDING_POINT_SYMBOL,
      snappingOptions: {
        enabled: true,
        featureSources: buildSnappingSources(view.map),
      },
    });

    this.eventHandle = this.sketchViewModel.on('create', (event) => {
      if (event.state === 'complete' && event.graphic?.geometry) {
        const point = event.graphic.geometry as Point;
        this.store.setAddingGeometry(point);
        this.store.setSketchActive(false);
        this.cleanupSketch();
        this.refreshDisplayLayer();
      }
    });

    this.sketchViewModel.create('point');
    this.store.setSketchActive(true);
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

  confirmAdd(): void {
    const geometry = this.store.addingGeometry();
    if (!geometry) return;

    const newPoint: ReferencePoint = {
      objectId: undefined,
      globalId: undefined,
      geometry,
      attributes: { ...this.store.addingAttributes() },
      isNew: true,
      isModified: false,
    };

    this.store.addPoint(newPoint);
    this.store.cancelAdding();
    this.refreshDisplayLayer();
  }

  cancelAdd(): void {
    this.cleanupSketch();
    this.store.cancelAdding();
  }

  // --- Editing ---

  startEditingPoint(index: number): void {
    this.store.setActiveEdit(index);
  }

  startEditingPointGeometry(index: number): void {
    const point = this.store.points()[index];
    if (!point?.geometry) return;

    const view = this.viewService.getMapView();
    if (!view?.map) return;

    this.cleanupSketch();

    this.sketchLayer = new GraphicsLayer({ listMode: 'hide' });
    view.map.add(this.sketchLayer);

    const graphic = new Graphic({
      geometry: point.geometry.clone(),
      symbol: ADDING_POINT_SYMBOL,
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
          const updatedPoint: ReferencePoint = {
            ...point,
            geometry: updatedGeometry,
            isModified: !point.isNew,
          };
          this.store.updatePoint(index, updatedPoint);
        }
      }
      if (event.state === 'complete') {
        this.cleanupSketch();
        this.store.setSketchActive(false);
        this.refreshDisplayLayer();
      }
    });

    this.sketchViewModel.update(graphic, { tool: 'move' });
    this.store.setSketchActive(true);
  }

  updatePointAttribute(index: number, fieldName: string, value: AttributeValue): void {
    const point = this.store.points()[index];
    if (!point) return;

    const updatedPoint: ReferencePoint = {
      ...point,
      attributes: { ...point.attributes, [fieldName]: value },
      isModified: !point.isNew,
    };
    this.store.updatePoint(index, updatedPoint);
  }

  confirmEditPoint(): void {
    this.cleanupSketch();
    this.store.setActiveEdit(undefined);
    this.refreshDisplayLayer();
  }

  deletePoint(index: number): void {
    this.store.removePoint(index);
    this.refreshDisplayLayer();
  }

  // --- Save ---

  async save(parentId: string, parentLayerId: number): Promise<void> {
    const relationship = this.store.relationship();
    if (!relationship) return;

    this.store.setSaving(true);
    try {
      await applyPointEdits(
        relationship.relatedLayer,
        this.store.points(),
        this.store.deletedObjectIds(),
        parentId,
        parentLayerId,
      );
      this.store.setSaving(false);
    } catch (error) {
      this.store.setSaving(false);
      throw new ReferencePointSaveError(error);
    }
  }

  // --- Cleanup ---

  cleanup(): void {
    this.cleanupSketch();
    this.removeDisplayLayer();
  }

  reset(): void {
    this.cleanup();
    this.store.reset();
  }

  // --- Display ---

  toggleDisplay(): void {
    const visible = !this.store.displayVisible();
    this.store.setDisplayVisible(visible);
    if (visible) {
      this.refreshDisplayLayer();
    } else {
      this.removeDisplayLayer();
    }
  }

  togglePointVisibility(index: number): void {
    this.store.togglePointHidden(index);
    this.refreshDisplayLayer();
  }

  refreshDisplayLayer(): void {
    const view = this.viewService.getMapView();
    if (!view?.map) return;

    this.removeDisplayLayer();

    if (!this.store.displayVisible()) return;

    const hiddenIndices = this.store.hiddenPointIndices();
    const graphics = this.store
      .points()
      .filter((p, i) => p.geometry && !hiddenIndices.includes(i))
      .map((p) => new Graphic({ geometry: p.geometry, symbol: REF_POINT_VON_SYMBOL }));

    const addingGeometry = this.store.addingGeometry();
    if (addingGeometry) {
      graphics.push(new Graphic({ geometry: addingGeometry, symbol: ADDING_POINT_SYMBOL }));
    }

    if (graphics.length === 0) return;

    this.displayLayer = new GraphicsLayer({ listMode: 'hide', title: 'Von Punkte' });
    this.displayLayer.addMany(graphics);
    view.map.add(this.displayLayer);
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

  private removeDisplayLayer(): void {
    const view = this.viewService.getMapView();
    if (this.displayLayer && view?.map) {
      view.map.remove(this.displayLayer);
      this.displayLayer.destroy();
    }
    this.displayLayer = undefined;
  }
}
