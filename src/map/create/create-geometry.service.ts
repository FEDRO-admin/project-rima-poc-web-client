import { DestroyRef, inject, Injectable } from '@angular/core';
import SketchViewModel from '@arcgis/core/widgets/Sketch/SketchViewModel';
import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import type Map from '@arcgis/core/Map';
import type { CreateTool } from '@arcgis/core/widgets/Sketch/types';
import FeatureSnappingLayerSource from '@arcgis/core/views/interactive/snapping/FeatureSnappingLayerSource';
import { MapViewService } from '../view/view.service';
import { CreateStore } from './create.store';
import { getDefaultCreateTool } from './create-config';
import { EDIT_POINT_SYMBOL, EDIT_LINE_SYMBOL, EDIT_POLYGON_SYMBOL } from '../edit/edit-config';

@Injectable({
  providedIn: 'root',
})
export class CreateGeometryService {
  private readonly viewService = inject(MapViewService);
  private readonly store = inject(CreateStore);
  private readonly destroyRef = inject(DestroyRef);

  private sketchViewModel: SketchViewModel | undefined;
  private sketchLayer: GraphicsLayer | undefined;
  private eventHandle: { remove(): void } | undefined;

  constructor() {
    this.destroyRef.onDestroy(() => this.cleanup());
  }

  startDrawing(layer: FeatureLayer, tool?: CreateTool): void {
    const view = this.viewService.mapView();
    if (!view?.map) return;

    this.cleanup();

    this.sketchLayer = new GraphicsLayer({ listMode: 'hide' });
    view.map.add(this.sketchLayer);

    const createTool = tool ?? getDefaultCreateTool(layer.geometryType);

    this.sketchViewModel = new SketchViewModel({
      view,
      layer: this.sketchLayer,
      pointSymbol: EDIT_POINT_SYMBOL,
      polylineSymbol: EDIT_LINE_SYMBOL,
      polygonSymbol: EDIT_POLYGON_SYMBOL,
      snappingOptions: {
        enabled: true,
        featureSources: this.buildSnappingSources(view.map),
      },
    });

    this.eventHandle = this.sketchViewModel.on('create', (event) => {
      if (event.state === 'active') {
        this.store.setSketchActive(true);
      }
      if (event.state === 'complete' && event.graphic?.geometry) {
        this.store.updateGeometry(event.graphic.geometry);
        this.store.deactivateSketch();
      }
      this.updateUndoRedoState();
    });

    this.sketchViewModel.create(createTool);
    this.store.setSketchActive(true);
  }

  redraw(layer: FeatureLayer, tool?: CreateTool): void {
    const view = this.viewService.mapView();
    if (!view?.map) return;

    this.cleanup();
    this.store.updateGeometry(undefined!);
    this.startDrawing(layer, tool);
  }

  undo(): void {
    this.sketchViewModel?.undo();
    this.updateUndoRedoState();
  }

  redo(): void {
    this.sketchViewModel?.redo();
    this.updateUndoRedoState();
  }

  cancel(): void {
    this.cleanup();
  }

  cleanup(): void {
    this.eventHandle?.remove();
    this.eventHandle = undefined;

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

  private updateUndoRedoState(): void {
    this.store.setUndoRedo(this.sketchViewModel?.canUndo() ?? false, this.sketchViewModel?.canRedo() ?? false);
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
