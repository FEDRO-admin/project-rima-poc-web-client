import { DestroyRef, effect, inject, Injectable, untracked } from '@angular/core';
import { MapViewService } from '../view/view.service';
import { PopupStore } from './popup.store';
import { EditStore } from '../edit/edit.store';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import MapView from '@arcgis/core/views/MapView';
import type { GraphicHit } from '@arcgis/core/views/types';

interface Handle {
  remove(): void;
}

@Injectable({
  providedIn: 'root',
})
export class PopupClickService {
  private readonly viewService = inject(MapViewService);
  private readonly popupStore = inject(PopupStore);
  private readonly editStore = inject(EditStore);
  private readonly destroyRef = inject(DestroyRef);

  private clickHandle: Handle | undefined;

  constructor() {
    effect(() => {
      const view = this.viewService.mapView();
      untracked(() => {
        if (view) {
          this.attach(view);
        }
      });
    });

    this.destroyRef.onDestroy(() => this.detach());
  }

  private attach(view: MapView): void {
    this.detach();

    view.popupEnabled = false;

    this.clickHandle = view.on('click', (event) => {
      this.handleClick(view, event);
    });
  }

  private detach(): void {
    this.clickHandle?.remove();
    this.clickHandle = undefined;
  }

  private async handleClick(view: MapView, event: { x: number; y: number }): Promise<void> {
    if (!view.map) return;

    // Ignore all map clicks while in edit mode
    if (this.editStore.editing()) {
      return;
    }

    const response = await view.hitTest(event, {
      include: view.map.allLayers.filter((layer) => layer.type === 'feature').toArray() as FeatureLayer[],
    });

    const graphics = response.results
      .filter((result): result is GraphicHit => result.type === 'graphic')
      .map((result) => result.graphic);

    if (graphics.length > 0) {
      this.popupStore.open(graphics);
    } else {
      this.popupStore.close();
    }
  }
}
