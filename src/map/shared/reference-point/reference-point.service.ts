import { inject, Injectable, OnDestroy } from '@angular/core';
import Graphic from '@arcgis/core/Graphic';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer';
import SketchViewModel from '@arcgis/core/widgets/Sketch/SketchViewModel';
import Point from '@arcgis/core/geometry/Point';
import SimpleMarkerSymbol from '@arcgis/core/symbols/SimpleMarkerSymbol';
import { MapViewService } from '../../view/view.service';
import { ReferencePointStore } from './reference-point.store';
import { ReferencePointResolutionService } from './reference-point-resolution.service';
import { ReferencePointSaveError, ReferencePointLoadError } from './reference-point-errors';
import {
  ReferencePoint,
  ReferencePointRelationshipInfo,
  ReferencePointType,
  AttributeValue,
} from './reference-point-types';
import { buildSnappingSources, cleanupSketchResources } from '../sketch-utils';
import { RIMA_SPATIAL_REFERENCE_LV95_EPSG, RIMA_SWITZERLAND_EXTENT } from '../../map-constants';

const VON_POINT_SYMBOL = new SimpleMarkerSymbol({
  style: 'circle',
  color: [0, 121, 193, 0.8],
  size: 10,
  outline: { color: [255, 255, 255], width: 2 },
});

const BIS_POINT_SYMBOL = new SimpleMarkerSymbol({
  style: 'circle',
  color: [193, 64, 0, 0.8],
  size: 10,
  outline: { color: [255, 255, 255], width: 2 },
});

const ADDING_POINT_SYMBOL = new SimpleMarkerSymbol({
  style: 'diamond',
  color: [46, 204, 113, 0.9],
  size: 12,
  outline: { color: [255, 255, 255], width: 2 },
});

@Injectable({
  providedIn: 'root',
})
export class ReferencePointService implements OnDestroy {
  private readonly viewService = inject(MapViewService);
  private readonly store = inject(ReferencePointStore);
  private readonly resolutionService = inject(ReferencePointResolutionService);

  private displayLayer: GraphicsLayer | undefined;
  private sketchViewModel: SketchViewModel | undefined;
  private sketchLayer: GraphicsLayer | undefined;
  private eventHandle: { remove(): void } | undefined;

  ngOnDestroy(): void {
    this.reset();
  }

  async loadForFeature(graphic: Graphic): Promise<void> {
    const layer = graphic.layer;
    if (!(layer instanceof FeatureLayer)) return;

    const relationships = this.resolutionService.resolveRelationships(layer);
    if (relationships.length === 0) return;

    const vonRel = relationships.find((r) => r.type === 'von');
    const bisRel = relationships.find((r) => r.type === 'bis');

    this.store.initialize(vonRel, bisRel);
    this.store.setLoading(true);

    try {
      if (vonRel) {
        const vonPoints = await this.resolutionService.queryExistingPoints(layer, graphic, vonRel.relationshipId);
        this.store.setPoints('von', vonPoints);
      }
      if (bisRel) {
        const bisPoints = await this.resolutionService.queryExistingPoints(layer, graphic, bisRel.relationshipId);
        this.store.setPoints('bis', bisPoints);
      }
      this.store.setLoading(false);
      this.refreshDisplayLayer();
    } catch (error) {
      this.store.setLoading(false);
      throw new ReferencePointLoadError(error);
    }
  }

  initializeForCreate(layer: FeatureLayer): void {
    const relationships = this.resolutionService.resolveRelationships(layer);
    if (relationships.length === 0) return;

    const vonRel = relationships.find((r) => r.type === 'von');
    const bisRel = relationships.find((r) => r.type === 'bis');

    this.store.initialize(vonRel, bisRel);
  }

  startAdding(type: ReferencePointType): void {
    this.store.startAdding(type);
  }

  startPlacingOnMap(): void {
    const view = this.viewService.mapView();
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
    const type = this.store.addingType();
    const geometry = this.store.addingGeometry();
    if (!type || !geometry) return;

    const attributes = { ...this.store.addingAttributes() };
    const newPoint: ReferencePoint = {
      objectId: undefined,
      globalId: undefined,
      geometry,
      attributes,
      isNew: true,
      isModified: false,
    };

    this.store.addPoint(type, newPoint);
    this.store.cancelAdding();
    this.refreshDisplayLayer();
  }

  cancelAdd(): void {
    this.cleanupSketch();
    this.store.cancelAdding();
  }

  startEditingPoint(type: ReferencePointType, index: number): void {
    this.store.setActiveEdit(type, index);
  }

  startEditingPointGeometry(type: ReferencePointType, index: number): void {
    const points = type === 'von' ? this.store.vonPoints() : this.store.bisPoints();
    const point = points[index];
    if (!point?.geometry) return;

    const view = this.viewService.mapView();
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
          this.store.updatePoint(type, index, updatedPoint);
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

  updatePointAttribute(type: ReferencePointType, index: number, fieldName: string, value: AttributeValue): void {
    const points = type === 'von' ? this.store.vonPoints() : this.store.bisPoints();
    const point = points[index];
    if (!point) return;

    const updatedPoint: ReferencePoint = {
      ...point,
      attributes: { ...point.attributes, [fieldName]: value },
      isModified: !point.isNew,
    };
    this.store.updatePoint(type, index, updatedPoint);
  }

  confirmEditPoint(): void {
    this.cleanupSketch();
    this.store.clearActiveEdit();
    this.refreshDisplayLayer();
  }

  deletePoint(type: ReferencePointType, index: number): void {
    this.store.removePoint(type, index);
    this.refreshDisplayLayer();
  }

  async saveAll(parentId: string): Promise<void> {
    const vonRel = this.store.vonRelationship();
    const bisRel = this.store.bisRelationship();

    this.store.setSaving(true);

    try {
      if (vonRel) {
        await this.savePointsForType('von', vonRel, parentId);
      }
      if (bisRel) {
        await this.savePointsForType('bis', bisRel, parentId);
      }
      this.store.setSaving(false);
    } catch (error) {
      this.store.setSaving(false);
      throw new ReferencePointSaveError(error);
    }
  }

  reset(): void {
    this.cleanupSketch();
    this.removeDisplayLayer();
    this.store.reset();
  }

  refreshDisplayLayer(): void {
    const view = this.viewService.mapView();
    if (!view?.map) return;

    this.removeDisplayLayer();

    const vonPoints = this.store.vonPoints();
    const bisPoints = this.store.bisPoints();
    if (vonPoints.length === 0 && bisPoints.length === 0) return;

    this.displayLayer = new GraphicsLayer({ listMode: 'hide', title: 'Reference Points' });

    for (const point of vonPoints) {
      if (point.geometry) {
        this.displayLayer.add(new Graphic({ geometry: point.geometry, symbol: VON_POINT_SYMBOL }));
      }
    }

    for (const point of bisPoints) {
      if (point.geometry) {
        this.displayLayer.add(new Graphic({ geometry: point.geometry, symbol: BIS_POINT_SYMBOL }));
      }
    }

    view.map.add(this.displayLayer);
  }

  private async savePointsForType(
    type: ReferencePointType,
    relInfo: ReferencePointRelationshipInfo,
    parentId: string,
  ): Promise<void> {
    const layer = relInfo.relatedLayer;
    const points = type === 'von' ? this.store.vonPoints() : this.store.bisPoints();
    const deletedIds = type === 'von' ? this.store.deletedVonObjectIds() : this.store.deletedBisObjectIds();

    // Delete removed points
    if (deletedIds.length > 0) {
      const deleteGraphics = deletedIds.map((oid) => new Graphic({ attributes: { [layer.objectIdField]: oid } }));
      const deleteResult = await layer.applyEdits({ deleteFeatures: deleteGraphics });
      const failedDelete = deleteResult.deleteFeatureResults.find((r: { error?: unknown }) => r.error);
      if (failedDelete?.error) {
        throw failedDelete.error;
      }
    }

    // Add new points
    const newPoints = points.filter((p) => p.isNew);
    if (newPoints.length > 0) {
      const addGraphics = newPoints.map((p) => {
        // eslint-disable-next-line @typescript-eslint/naming-convention -- parent_id matches the ArcGIS field name
        const attributes: Record<string, AttributeValue> = { ...p.attributes, parent_id: parentId };
        return new Graphic({ attributes, geometry: p.geometry });
      });
      const addResult = await layer.applyEdits({ addFeatures: addGraphics });
      const failedAdd = addResult.addFeatureResults.find((r: { error?: unknown }) => r.error);
      if (failedAdd?.error) {
        throw failedAdd.error;
      }
    }

    // Update modified points
    const modifiedPoints = points.filter((p) => p.isModified && !p.isNew);
    if (modifiedPoints.length > 0) {
      const updateGraphics = modifiedPoints.map((p) => {
        const attributes = {
          ...p.attributes,
          [layer.objectIdField]: p.objectId,
        } as Record<string, AttributeValue>;
        return new Graphic({ attributes, geometry: p.geometry });
      });
      const updateResult = await layer.applyEdits({ updateFeatures: updateGraphics });
      const failedUpdate = updateResult.updateFeatureResults.find((r: { error?: unknown }) => r.error);
      if (failedUpdate?.error) {
        throw failedUpdate.error;
      }
    }

    layer.refresh();
  }

  private cleanupSketch(): void {
    this.eventHandle?.remove();
    this.eventHandle = undefined;

    const view = this.viewService.mapView();
    const cleaned = cleanupSketchResources(this.sketchViewModel, this.sketchLayer, view);
    this.sketchViewModel = cleaned.sketchViewModel;
    this.sketchLayer = cleaned.sketchLayer;
  }

  private removeDisplayLayer(): void {
    const view = this.viewService.mapView();
    if (this.displayLayer && view?.map) {
      view.map.remove(this.displayLayer);
      this.displayLayer.destroy();
    }
    this.displayLayer = undefined;
  }
}
