import { DestroyRef, inject, Injectable } from '@angular/core';
import SketchViewModel from '@arcgis/core/widgets/Sketch/SketchViewModel';
import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer';
import Graphic from '@arcgis/core/Graphic';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import type Geometry from '@arcgis/core/geometry/Geometry';
import type Map from '@arcgis/core/Map';
import FeatureSnappingLayerSource from '@arcgis/core/views/interactive/snapping/FeatureSnappingLayerSource';
import { MapViewService } from '../../view/view.service';
import type MapView from '@arcgis/core/views/MapView';
import { GeometryEditStore } from './geometry-edit.store';
import { EditSaveError } from '../edit-errors';
import { EDIT_LINE_SYMBOL, EDIT_POINT_SYMBOL, EDIT_POLYGON_SYMBOL } from '../edit-config';

type SketchTool = 'move' | 'reshape' | 'transform';

@Injectable({
  providedIn: 'root',
})
export class GeometryEditService {
  private readonly viewService = inject(MapViewService);
  private readonly store = inject(GeometryEditStore);
  private readonly destroyRef = inject(DestroyRef);

  private sketchViewModel: SketchViewModel | undefined;
  private sketchLayer: GraphicsLayer | undefined;
  private sketchGraphic: Graphic | undefined;
  private eventHandle: { remove(): void } | undefined;

  private _graphic: Graphic | undefined;
  private _originalGeometry: Geometry | undefined;

  constructor() {
    this.destroyRef.onDestroy(() => this.reset());
  }

  startEditing(graphic: Graphic): void {
    const view = this.viewService.mapView();
    if (!view?.map || !graphic.geometry) return;

    this.reset();

    this._graphic = graphic;
    this._originalGeometry = graphic.geometry.clone();
    this.store.setEditing(true);

    this.activateSketch(view, graphic.geometry);
  }

  reenterSketch(): void {
    const view = this.viewService.mapView();
    if (!view?.map || !this._graphic) return;

    const geometry = this.store.editedGeometry() ?? this._graphic.geometry;
    if (!geometry) return;

    this.deactivateSketch();
    this.activateSketch(view, geometry);
  }

  async save(): Promise<void> {
    if (!this._graphic) return;

    const layer = this._graphic.layer;
    if (!(layer instanceof FeatureLayer)) return;

    this.store.setSaving(true);

    try {
      this.deactivateSketch();

      const geometry = this.store.editedGeometry();
      if (!geometry) return;

      const objectIdField = layer.objectIdField;
      const updateGraphic = new Graphic({
        attributes: { [objectIdField]: this._graphic.attributes[objectIdField] },
        geometry,
      });

      const result = await layer.applyEdits({ updateFeatures: [updateGraphic] });
      const updateResult = result.updateFeatureResults[0];

      if (updateResult?.error) {
        throw new EditSaveError(updateResult.error);
      }

      this.reset();
    } catch (error) {
      this.store.setSaving(false);
      if (error instanceof EditSaveError) {
        throw error;
      }
      throw new EditSaveError(error);
    }
  }

  cancel(): void {
    if (this._graphic && this._originalGeometry) {
      this._graphic.geometry = this._originalGeometry;
    }
    this.reset();
  }

  reset(): void {
    this.deactivateSketch();
    this._graphic = undefined;
    this._originalGeometry = undefined;
    this.store.reset();
  }

  undo(): void {
    this.sketchViewModel?.undo();
    this.updateUndoRedoState();
  }

  redo(): void {
    this.sketchViewModel?.redo();
    this.updateUndoRedoState();
  }

  private activateSketch(view: MapView, geometry: Geometry): void {
    this.sketchLayer = new GraphicsLayer({ listMode: 'hide' });
    view.map!.add(this.sketchLayer);

    this.sketchGraphic = new Graphic({
      geometry: geometry.clone(),
      symbol: this.getEditSymbol(geometry.type),
    });
    this.sketchLayer.add(this.sketchGraphic);

    this.sketchViewModel = new SketchViewModel({
      view,
      layer: this.sketchLayer,
      updateOnGraphicClick: false,
      defaultUpdateOptions: {
        tool: this.getToolForGeometryType(geometry.type),
        enableRotation: false,
        enableScaling: false,
        reshapeOptions: { edgeOperation: 'split', shapeOperation: 'move' },
      },
      snappingOptions: {
        enabled: true,
        featureSources: this.buildSnappingSources(view.map!),
      },
    });

    this.eventHandle = this.sketchViewModel.on('update', (event) => {
      if (event.state === 'active' || event.state === 'complete') {
        const updatedGeometry = event.graphics[0]?.geometry;
        if (updatedGeometry) {
          this.store.updateGeometry(updatedGeometry);
        }
      }
      if (event.state === 'complete') {
        this.onSketchComplete();
      }
      this.updateUndoRedoState();
    });

    this.sketchViewModel.update(this.sketchGraphic);
    this.store.setSketchActive(true);
  }

  private deactivateSketch(): void {
    this.eventHandle?.remove();
    this.eventHandle = undefined;
    this.sketchGraphic = undefined;

    if (this.sketchViewModel) {
      this.sketchViewModel.cancel();
      this.sketchViewModel.destroy();
      this.sketchViewModel = undefined;
    }

    if (this.sketchLayer) {
      const view = this.viewService.mapView();
      if (view?.map) {
        view.map.remove(this.sketchLayer);
      }
      this.sketchLayer.destroy();
      this.sketchLayer = undefined;
    }

    this.store.deactivateSketch();
  }

  private onSketchComplete(): void {
    const editedGeometry = this.store.editedGeometry();
    if (this._graphic && editedGeometry) {
      this._graphic.geometry = editedGeometry;
    }
    // Fallback: if the sketch completes despite click interception, re-enter
    if (this.sketchViewModel && this.sketchGraphic) {
      this.sketchViewModel.update(this.sketchGraphic);
    }
  }

  private updateUndoRedoState(): void {
    this.store.setUndoRedo(this.sketchViewModel?.canUndo() ?? false, this.sketchViewModel?.canRedo() ?? false);
  }

  private getToolForGeometryType(geometryType: string): SketchTool {
    switch (geometryType) {
      case 'point':
      case 'multipoint':
        return 'move';
      default:
        return 'reshape';
    }
  }

  private getEditSymbol(
    geometryType: string,
  ): typeof EDIT_POINT_SYMBOL | typeof EDIT_LINE_SYMBOL | typeof EDIT_POLYGON_SYMBOL {
    switch (geometryType) {
      case 'point':
      case 'multipoint':
        return EDIT_POINT_SYMBOL;
      case 'polyline':
        return EDIT_LINE_SYMBOL;
      default:
        return EDIT_POLYGON_SYMBOL;
    }
  }

  private buildSnappingSources(map: Map): FeatureSnappingLayerSource[] {
    const sources: FeatureSnappingLayerSource[] = [];
    map.allLayers.forEach((layer) => {
      if (layer instanceof FeatureLayer) {
        sources.push(new FeatureSnappingLayerSource({ layer, enabled: true }));
      }
    });
    return sources;
  }
}
