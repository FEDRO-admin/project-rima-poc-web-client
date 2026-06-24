import { DestroyRef, inject, Injectable } from '@angular/core';
import SketchViewModel from '@arcgis/core/widgets/Sketch/SketchViewModel';
import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer';
import Graphic from '@arcgis/core/Graphic';
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
  private updateEventHandle: { remove(): void } | undefined;
  private sketchGraphic: Graphic | undefined;

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
        this.sketchGraphic = event.graphic;
        this.store.updateGeometry(event.graphic.geometry);
        this.store.setSketchActive(false);
        this.startAdjusting();
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

  confirmPlacement(): void {
    this.updateEventHandle?.remove();
    this.updateEventHandle = undefined;

    if (this.sketchViewModel) {
      this.sketchViewModel.cancel();
    }

    const geometry = this.sketchGraphic?.geometry;
    if (geometry) {
      this.store.updateGeometry(geometry);
    }

    this.store.setAdjusting(false);
  }

  reenterAdjusting(): void {
    if (!this.sketchViewModel || !this.sketchGraphic) return;
    this.store.setAdjusting(true);

    this.updateEventHandle = this.sketchViewModel.on('update', (event) => {
      if (event.state === 'active' || event.state === 'complete') {
        const updatedGeometry = event.graphics[0]?.geometry;
        if (updatedGeometry) {
          this.sketchGraphic = event.graphics[0];
          this.store.updateGeometry(updatedGeometry);
        }
      }
      if (event.state === 'complete') {
        this.reenterUpdate();
      }
      this.updateUndoRedoState();
    });

    const tool = this.getAdjustTool(this.sketchGraphic.geometry?.type);
    this.sketchViewModel.update(this.sketchGraphic, {
      tool,
      enableRotation: true,
      enableScaling: false,
      toggleToolOnClick: true,
    });
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
    this.updateEventHandle?.remove();
    this.updateEventHandle = undefined;
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

  private startAdjusting(): void {
    if (!this.sketchViewModel || !this.sketchGraphic) return;

    this.store.setAdjusting(true);

    this.updateEventHandle = this.sketchViewModel.on('update', (event) => {
      if (event.state === 'active' || event.state === 'complete') {
        const updatedGeometry = event.graphics[0]?.geometry;
        if (updatedGeometry) {
          this.sketchGraphic = event.graphics[0];
          this.store.updateGeometry(updatedGeometry);
        }
      }
      if (event.state === 'complete') {
        this.reenterUpdate();
      }
      this.updateUndoRedoState();
    });

    const tool = this.getAdjustTool(this.sketchGraphic.geometry?.type);
    this.sketchViewModel.update(this.sketchGraphic, {
      tool,
      enableRotation: true,
      enableScaling: false,
      toggleToolOnClick: true,
    });
  }

  private reenterUpdate(): void {
    if (this.sketchViewModel && this.sketchGraphic) {
      const tool = this.getAdjustTool(this.sketchGraphic.geometry?.type);
      this.sketchViewModel.update(this.sketchGraphic, {
        tool,
        enableRotation: true,
        enableScaling: false,
        toggleToolOnClick: true,
      });
    }
  }

  private getAdjustTool(geometryType: string | undefined): 'transform' | 'reshape' {
    return 'transform';
  }

  private cleanupSketchResources(): void {
    this.sketchGraphic = undefined;

    if (this.sketchViewModel) {
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
