import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import SketchViewModel from '@arcgis/core/widgets/Sketch/SketchViewModel';
import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer';
import Graphic from '@arcgis/core/Graphic';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import type Map from '@arcgis/core/Map';
import FeatureSnappingLayerSource from '@arcgis/core/views/interactive/snapping/FeatureSnappingLayerSource';
import { MapViewService } from '../../view/view.service';
import { EditStore } from '../edit.store';
import { EDIT_LINE_SYMBOL, EDIT_POINT_SYMBOL, EDIT_POLYGON_SYMBOL } from '../edit-config';

type SketchTool = 'move' | 'reshape' | 'transform';

@Injectable({
  providedIn: 'root',
})
export class GeometryEditService {
  private readonly viewService = inject(MapViewService);
  private readonly editStore = inject(EditStore);
  private readonly destroyRef = inject(DestroyRef);

  private sketchViewModel: SketchViewModel | undefined;
  private sketchLayer: GraphicsLayer | undefined;
  private sketchGraphic: Graphic | undefined;
  private eventHandle: { remove(): void } | undefined;

  readonly canUndo = signal(false);
  readonly canRedo = signal(false);

  constructor() {
    this.destroyRef.onDestroy(() => this.deactivate());
  }

  activate(graphic: Graphic): void {
    const view = this.viewService.mapView();
    if (!view?.map || !graphic.geometry) return;

    this.deactivate();

    this.sketchLayer = new GraphicsLayer({ listMode: 'hide' });
    view.map.add(this.sketchLayer);

    this.sketchGraphic = new Graphic({
      geometry: graphic.geometry.clone(),
      symbol: this.getEditSymbol(graphic.geometry.type),
    });
    this.sketchLayer.add(this.sketchGraphic);

    this.sketchViewModel = new SketchViewModel({
      view,
      layer: this.sketchLayer,
      updateOnGraphicClick: false,
      defaultUpdateOptions: {
        tool: this.getToolForGeometryType(graphic.geometry.type),
        enableRotation: false,
        enableScaling: false,
        reshapeOptions: { edgeOperation: 'split', shapeOperation: 'move' },
      },
      snappingOptions: {
        enabled: true,
        featureSources: this.buildSnappingSources(view.map),
      },
    });

    this.eventHandle = this.sketchViewModel.on('update', (event) => {
      if (event.state === 'active' || event.state === 'complete') {
        const updatedGeometry = event.graphics[0]?.geometry;
        if (updatedGeometry) {
          this.editStore.updateGeometry(updatedGeometry);
        }
      }
      if (event.state === 'complete' && this.sketchGraphic) {
        this.sketchViewModel!.update(this.sketchGraphic);
      }
      this.updateUndoRedoState();
    });

    this.sketchViewModel.update(this.sketchGraphic);
    this.editStore.enableGeometryEditing();
  }

  deactivate(): void {
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

    this.canUndo.set(false);
    this.canRedo.set(false);
    this.editStore.disableGeometryEditing();
  }

  undo(): void {
    this.sketchViewModel?.undo();
    this.updateUndoRedoState();
  }

  redo(): void {
    this.sketchViewModel?.redo();
    this.updateUndoRedoState();
  }

  private updateUndoRedoState(): void {
    this.canUndo.set(this.sketchViewModel?.canUndo() ?? false);
    this.canRedo.set(this.sketchViewModel?.canRedo() ?? false);
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
