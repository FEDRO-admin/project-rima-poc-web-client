import { inject, Injectable, OnDestroy } from '@angular/core';
import Graphic from '@arcgis/core/Graphic';
import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer';
import GroupLayer from '@arcgis/core/layers/GroupLayer';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import Layer from '@arcgis/core/layers/Layer';
import SketchViewModel from '@arcgis/core/widgets/Sketch/SketchViewModel';
import type Point from '@arcgis/core/geometry/Point';
import type EsriMap from '@arcgis/core/Map';
import { StatusGeometryStore } from './status-geometry.store';
import { STATUS_POINT_PLACING_SYMBOL } from './status-geometry-config';
import { STATUS_MAP_LAYER_TITLE } from './status-config';
import { ViewService } from '../../view/view.service';
import { ViewStore } from '../../view/view.store';
import { buildSnappingSources, cleanupSketchResources } from '../../shared/sketch-utils';

@Injectable()
export class StatusGeometryService implements OnDestroy {
  private readonly geometryStore = inject(StatusGeometryStore);
  private readonly viewService = inject(ViewService);
  private readonly viewStore = inject(ViewStore);

  private sketchViewModel: SketchViewModel | undefined;
  private sketchLayer: GraphicsLayer | undefined;
  private eventHandle: { remove(): void } | undefined;
  private highlightHandle: { remove(): void } | undefined;
  private previousVisibility: { layer: Layer; visible: boolean }[] = [];
  private previousIndex: number | undefined;

  ngOnDestroy(): void {
    this.cleanup();
  }

  // --- Status Layer Activation ---

  activateStatusLayer(): void {
    const layer = this.findStatusLayer();
    if (!layer) return;

    this.previousVisibility = [];
    this.saveAndActivate(layer);

    const view = this.viewService.activeView();
    if (view?.map) {
      const topLayerParent = this.getTopLevelParent(layer, view.map);
      if (topLayerParent) {
        const layers = view.map.layers;
        this.previousIndex = layers.indexOf(topLayerParent);
        view.map.reorder(topLayerParent, layers.length - 1);
      }
    }
  }

  private saveAndActivate(layer: Layer): void {
    this.previousVisibility.push({ layer, visible: layer.visible });
    layer.visible = true;

    const parent = layer.parent;
    if (parent instanceof GroupLayer) {
      this.saveAndActivate(parent);
    }
  }

  private getTopLevelParent(layer: Layer, map: EsriMap): Layer | undefined {
    let current: Layer = layer;
    while (current.parent instanceof GroupLayer) {
      current = current.parent;
    }
    return map.layers.includes(current) ? current : undefined;
  }

  private deactivateStatusLayer(): void {
    if (!this.previousVisibility.length) return;

    const view = this.viewService.activeView();
    if (view?.map && this.previousIndex !== undefined) {
      const layer = this.findStatusLayer();
      if (layer) {
        const topLayerParent = this.getTopLevelParent(layer, view.map);
        if (topLayerParent) {
          view.map.reorder(topLayerParent, this.previousIndex);
        }
      }
    }

    for (const entry of this.previousVisibility) {
      entry.layer.visible = entry.visible;
    }
    this.previousVisibility = [];
    this.previousIndex = undefined;
  }

  // --- Highlight ---

  async highlightRecords(objectIds: number[]): Promise<void> {
    this.clearHighlight();
    if (!objectIds.length) return;

    const layer = this.findStatusLayer();
    const view = this.viewService.activeView();
    if (!layer || !view) return;

    const layerView = await view.whenLayerView(layer);
    if (typeof (layerView as unknown as Record<string, unknown>)['highlight'] !== 'function') return;

    this.highlightHandle = (layerView as unknown as { highlight(ids: number[]): { remove(): void } }).highlight(
      objectIds,
    );
  }

  private clearHighlight(): void {
    this.highlightHandle?.remove();
    this.highlightHandle = undefined;
  }

  startPlacing(): void {
    const view = this.viewService.activeView();
    if (!view?.map) return;

    this.cleanupSketch();

    this.sketchLayer = new GraphicsLayer({ listMode: 'hide' });
    view.map.add(this.sketchLayer);

    this.sketchViewModel = new SketchViewModel({
      view,
      layer: this.sketchLayer,
      pointSymbol: STATUS_POINT_PLACING_SYMBOL,
      snappingOptions: {
        enabled: true,
        featureSources: buildSnappingSources(view.map),
      },
    });

    this.eventHandle = this.sketchViewModel.on('create', (event) => {
      if (event.state === 'complete' && event.graphic?.geometry) {
        const point = event.graphic.geometry as Point;
        this.geometryStore.setPlacedGeometry(point);
        this.viewStore.setSketchActive(false);
        this.cleanupSketch();
      }
    });

    this.sketchViewModel.create('point');
    this.geometryStore.setPlacingActive(true);
    this.viewStore.setSketchActive(true);
  }

  startAdjusting(geometry: Point): void {
    const view = this.viewService.activeView();
    if (!view?.map) return;

    this.cleanupSketch();

    this.sketchLayer = new GraphicsLayer({ listMode: 'hide' });
    view.map.add(this.sketchLayer);

    const graphic = new Graphic({
      geometry: geometry.clone(),
      symbol: STATUS_POINT_PLACING_SYMBOL,
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
          this.geometryStore.setPlacedGeometry(updatedGeometry);
        }
      }
      if (event.state === 'complete') {
        this.viewStore.setSketchActive(false);
        this.cleanupSketch();
      }
    });

    this.sketchViewModel.update(graphic, { tool: 'move' });
    this.viewStore.setSketchActive(true);
  }

  cancelPlacing(): void {
    this.cleanupSketch();
    this.viewStore.setSketchActive(false);
    this.geometryStore.setPlacedGeometry(undefined);
    this.geometryStore.setPlacingActive(false);
  }

  clearPlacedGeometry(): void {
    this.geometryStore.setPlacedGeometry(undefined);
  }

  cleanup(): void {
    this.cleanupSketch();
    this.clearHighlight();
    this.deactivateStatusLayer();
    this.geometryStore.reset();
  }

  private cleanupSketch(): void {
    this.eventHandle?.remove();
    this.eventHandle = undefined;

    const view = this.viewService.activeView();
    const cleaned = cleanupSketchResources(this.sketchViewModel, this.sketchLayer, view);
    this.sketchViewModel = cleaned.sketchViewModel;
    this.sketchLayer = cleaned.sketchLayer;
  }

  private findStatusLayer(): FeatureLayer | undefined {
    const view = this.viewService.activeView();
    if (!view?.map) return undefined;

    return view.map.allLayers.find((l: Layer) => l instanceof FeatureLayer && l.title === STATUS_MAP_LAYER_TITLE) as
      | FeatureLayer
      | undefined;
  }
}
