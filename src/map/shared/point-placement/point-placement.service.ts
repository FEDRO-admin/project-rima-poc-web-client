import { inject, Injectable, OnDestroy } from '@angular/core';
import Graphic from '@arcgis/core/Graphic';
import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer';
import SketchViewModel from '@arcgis/core/widgets/Sketch/SketchViewModel';
import type Point from '@arcgis/core/geometry/Point';
import { PointPlacementStore } from './point-placement.store';
import { POINT_PLACEMENT_CONFIG } from './point-placement-config';
import { ViewService } from '../../view/view.service';
import { ViewStore } from '../../view/view.store';
import { buildSnappingSources, cleanupSketchResources } from '../sketch-utils';

@Injectable()
export class PointPlacementService implements OnDestroy {
  private readonly store = inject(PointPlacementStore);
  private readonly viewService = inject(ViewService);
  private readonly viewStore = inject(ViewStore);
  private readonly config = inject(POINT_PLACEMENT_CONFIG);

  private sketchViewModel: SketchViewModel | undefined;
  private sketchLayer: GraphicsLayer | undefined;
  private displayLayer: GraphicsLayer | undefined;
  private eventHandle: { remove(): void } | undefined;

  ngOnDestroy(): void {
    this.cleanup();
  }

  startPlacing(): void {
    const view = this.viewService.activeView();
    if (!view?.map) return;

    this.cleanupSketch();
    this.clearDisplayGraphic();

    this.sketchLayer = new GraphicsLayer({ listMode: 'hide' });
    view.map.add(this.sketchLayer);

    this.sketchViewModel = new SketchViewModel({
      view,
      layer: this.sketchLayer,
      pointSymbol: this.config.placingSymbol,
      snappingOptions: {
        enabled: true,
        featureSources: buildSnappingSources(view.map),
      },
    });

    this.eventHandle = this.sketchViewModel.on('create', (event) => {
      if (event.state === 'complete' && event.graphic?.geometry) {
        const point = event.graphic.geometry as Point;
        this.store.setPlacedGeometry(point);
        this.viewStore.setSketchActive(false);
        this.cleanupSketch();
        this.showDisplayGraphic(point);
      }
    });

    this.sketchViewModel.create('point');
    this.store.setPlacingActive(true);
    this.viewStore.setSketchActive(true);
  }

  startAdjusting(geometry: Point): void {
    const view = this.viewService.activeView();
    if (!view?.map) return;

    this.cleanupSketch();
    this.clearDisplayGraphic();

    this.sketchLayer = new GraphicsLayer({ listMode: 'hide' });
    view.map.add(this.sketchLayer);

    const graphic = new Graphic({
      geometry: geometry.clone(),
      symbol: this.config.placingSymbol,
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
          this.store.setPlacedGeometry(updatedGeometry);
        }
      }
      if (event.state === 'complete') {
        const finalGeometry = event.graphics[0]?.geometry as Point | undefined;
        this.viewStore.setSketchActive(false);
        this.cleanupSketch();
        if (finalGeometry) {
          this.showDisplayGraphic(finalGeometry);
        }
      }
    });

    this.sketchViewModel.update(graphic, { tool: 'move' });
    this.viewStore.setSketchActive(true);
  }

  cancelPlacing(): void {
    this.cleanupSketch();
    this.clearDisplayGraphic();
    this.viewStore.setSketchActive(false);
    this.store.setPlacedGeometry(undefined);
    this.store.setPlacingActive(false);
  }

  clearPlacedGeometry(): void {
    this.clearDisplayGraphic();
    this.store.setPlacedGeometry(undefined);
  }

  cleanup(): void {
    this.cleanupSketch();
    this.clearDisplayGraphic();
    this.store.reset();
  }

  private showDisplayGraphic(point: Point): void {
    const view = this.viewService.activeView();
    if (!view?.map) return;

    this.clearDisplayGraphic();

    this.displayLayer = new GraphicsLayer({ listMode: 'hide' });
    const graphic = new Graphic({ geometry: point, symbol: this.config.placingSymbol });
    this.displayLayer.add(graphic);
    view.map.add(this.displayLayer);
  }

  private clearDisplayGraphic(): void {
    if (!this.displayLayer) return;

    const view = this.viewService.activeView();
    if (view?.map) {
      view.map.remove(this.displayLayer);
    }
    this.displayLayer.destroy();
    this.displayLayer = undefined;
  }

  private cleanupSketch(): void {
    this.eventHandle?.remove();
    this.eventHandle = undefined;

    const view = this.viewService.activeView();
    const cleaned = cleanupSketchResources(this.sketchViewModel, this.sketchLayer, view);
    this.sketchViewModel = cleaned.sketchViewModel;
    this.sketchLayer = cleaned.sketchLayer;
  }
}
