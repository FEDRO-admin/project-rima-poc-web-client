import { DestroyRef, inject, Injectable } from '@angular/core';
import SketchViewModel from '@arcgis/core/widgets/Sketch/SketchViewModel';
import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer';
import Graphic from '@arcgis/core/Graphic';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import SimpleMarkerSymbol from '@arcgis/core/symbols/SimpleMarkerSymbol';
import SimpleLineSymbol from '@arcgis/core/symbols/SimpleLineSymbol';
import SimpleFillSymbol from '@arcgis/core/symbols/SimpleFillSymbol';
import type Map from '@arcgis/core/Map';
import type FeatureSnappingLayerSource from '@arcgis/core/views/interactive/snapping/FeatureSnappingLayerSource';
import { MapViewService } from '../../view/view.service';
import { EditStore } from '../edit.store';

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
  private eventHandle: { remove(): void } | undefined;

  constructor() {
    this.destroyRef.onDestroy(() => this.deactivate());
  }

  activate(graphic: Graphic): void {
    const view = this.viewService.mapView();
    if (!view?.map || !graphic.geometry) return;

    this.deactivate();

    this.sketchLayer = new GraphicsLayer({ listMode: 'hide' });
    view.map.add(this.sketchLayer);

    const sketchGraphic = new Graphic({
      geometry: graphic.geometry.clone(),
      symbol: this.getEditSymbol(graphic.geometry.type),
    });
    this.sketchLayer.add(sketchGraphic);

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
    });

    this.sketchViewModel.update(sketchGraphic);
    this.editStore.enableGeometryEditing();
  }

  deactivate(): void {
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

    this.eventHandle?.remove();
    this.eventHandle = undefined;

    this.editStore.disableGeometryEditing();
  }

  undo(): void {
    this.sketchViewModel?.undo();
  }

  redo(): void {
    this.sketchViewModel?.redo();
  }

  get canUndo(): boolean {
    return this.sketchViewModel?.canUndo() ?? false;
  }

  get canRedo(): boolean {
    return this.sketchViewModel?.canRedo() ?? false;
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

  private getEditSymbol(geometryType: string): SimpleMarkerSymbol | SimpleLineSymbol | SimpleFillSymbol {
    switch (geometryType) {
      case 'point':
      case 'multipoint':
        return new SimpleMarkerSymbol({
          color: [0, 121, 193, 0.3],
          outline: { color: [0, 121, 193, 1], width: 2, style: 'dash' },
          size: 12,
        });
      case 'polyline':
        return new SimpleLineSymbol({
          color: [0, 121, 193, 1],
          width: 3,
          style: 'dash',
        });
      default:
        return new SimpleFillSymbol({
          color: [0, 121, 193, 0.1],
          outline: { color: [0, 121, 193, 1], width: 2, style: 'dash' },
        });
    }
  }

  private buildSnappingSources(map: Map): FeatureSnappingLayerSource[] {
    const sources: FeatureSnappingLayerSource[] = [];
    map.allLayers.forEach((layer) => {
      if (layer.type === 'feature') {
        sources.push({ layer: layer as FeatureLayer, enabled: true } as unknown as FeatureSnappingLayerSource);
      }
    });
    return sources;
  }
}
