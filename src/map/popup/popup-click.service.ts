import { DestroyRef, effect, inject, Injectable } from '@angular/core';
import { MapViewService } from '../view/view.service';
import { PopupStore } from './popup.store';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import MapView from '@arcgis/core/views/MapView';
import Point from '@arcgis/core/geometry/Point';
import Graphic from '@arcgis/core/Graphic';
import * as reactiveUtils from '@arcgis/core/core/reactiveUtils';

interface Handle {
  remove(): void;
}

interface GraphicHitResult {
  type: 'graphic';
  graphic: Graphic;
}

@Injectable({
  providedIn: 'root',
})
export class PopupClickService {
  private readonly viewService = inject(MapViewService);
  private readonly popupStore = inject(PopupStore);
  private readonly destroyRef = inject(DestroyRef);

  private clickHandle: Handle | undefined;
  private extentHandle: Handle | undefined;
  private stationaryHandle: Handle | undefined;
  private anchorZoom: number | undefined;

  constructor() {
    effect(() => {
      const view = this.viewService.mapView();
      if (view) {
        this.attach(view);
      }
    });

    this.destroyRef.onDestroy(() => this.detach());
  }

  private attach(view: MapView): void {
    this.detach();

    view.popupEnabled = false;
    this.anchorZoom = view.zoom;

    this.clickHandle = view.on('click', (event) => {
      this.handleClick(view, event);
    });

    this.extentHandle = reactiveUtils.watch(
      () => view.extent,
      () => {
        if (!this.popupStore.visible() || this.popupStore.docked()) return;
        // Only reposition on pan (zoom unchanged) — popup follows geographic point
        // On zoom (zoom changed) — popup stays at same screen position
        if (this.anchorZoom !== undefined && Math.abs(view.zoom - this.anchorZoom) < 0.001) {
          this.repositionFromAnchor(view);
        }
      },
    );

    this.stationaryHandle = reactiveUtils.watch(
      () => view.stationary,
      (stationary) => {
        if (stationary) {
          this.anchorZoom = view.zoom;
          this.updateAnchorFromScreen(view);
        }
      },
    );
  }

  private detach(): void {
    this.clickHandle?.remove();
    this.extentHandle?.remove();
    this.stationaryHandle?.remove();
    this.clickHandle = undefined;
    this.extentHandle = undefined;
    this.stationaryHandle = undefined;
  }

  private async handleClick(view: MapView, event: { x: number; y: number; mapPoint: Point }): Promise<void> {
    if (!view.map) return;

    const response = await view.hitTest(event, {
      include: view.map.allLayers.filter((layer) => layer.type === 'feature').toArray() as FeatureLayer[],
    });

    const graphics = response.results
      .filter((result) => result.type === 'graphic')
      .map((result) => (result as unknown as GraphicHitResult).graphic);

    if (graphics.length > 0) {
      this.popupStore.open(graphics, { x: event.x, y: event.y }, event.mapPoint);
    } else {
      this.popupStore.close();
    }
  }

  private repositionFromAnchor(view: MapView): void {
    if (!this.popupStore.visible() || this.popupStore.docked()) return;

    const anchorMapPoint = this.popupStore.anchorMapPoint();
    if (!anchorMapPoint) return;

    const screenPoint = view.toScreen(anchorMapPoint);
    if (screenPoint) {
      this.popupStore.updatePosition(this.clampToView(view, screenPoint.x, screenPoint.y));
    }
  }

  private clampToView(view: MapView, x: number, y: number): { x: number; y: number } {
    const popupWidth = 360;
    const popupHeight = 320;
    const padding = 8;

    // Popup is anchored at center-bottom (transform: translate(-50%, -100%))
    const minX = popupWidth / 2 + padding;
    const maxX = view.width - popupWidth / 2 - padding;
    const minY = popupHeight + padding + 12; // 12px offset from transform
    const maxY = view.height - padding;

    return {
      x: Math.max(minX, Math.min(maxX, x)),
      y: Math.max(minY, Math.min(maxY, y)),
    };
  }

  clampScreenPoint(x: number, y: number): { x: number; y: number } {
    const view = this.viewService.mapView();
    if (!view) return { x, y };
    return this.clampToView(view, x, y);
  }

  private updateAnchorFromScreen(view: MapView): void {
    if (!this.popupStore.visible() || this.popupStore.docked()) return;

    const screenPoint = this.popupStore.screenPoint();
    if (!screenPoint) return;

    const mapPoint = view.toMap(screenPoint);
    if (mapPoint) {
      this.popupStore.updateAnchor(screenPoint, mapPoint);
    }
  }
}
