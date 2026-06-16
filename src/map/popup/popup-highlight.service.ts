import { DestroyRef, effect, inject, Injectable, untracked } from '@angular/core';
import { MapViewService } from '../view/view.service';
import { PopupStore } from './popup.store';
import Graphic from '@arcgis/core/Graphic';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import { PopupHighlightError } from './popup-errors';

interface Handle {
  remove(): void;
}

@Injectable({
  providedIn: 'root',
})
export class PopupHighlightService {
  private readonly viewService = inject(MapViewService);
  private readonly popupStore = inject(PopupStore);
  private readonly destroyRef = inject(DestroyRef);

  private hoverHighlight: Handle | undefined;
  private selectionHighlight: Handle | undefined;

  constructor() {
    effect(() => {
      const selectedGraphic = this.popupStore.selectedGraphic();
      untracked(() => {
        this.clearSelectionHighlight();
        if (selectedGraphic) {
          this.highlightGraphic(selectedGraphic, 'selection');
        }
      });
    });

    effect(() => {
      const hoveredIndex = this.popupStore.hoveredIndex();
      untracked(() => {
        this.clearHoverHighlight();
        if (hoveredIndex != null) {
          const graphic = this.popupStore.graphics()[hoveredIndex];
          if (graphic) {
            this.highlightGraphic(graphic, 'hover');
          }
        }
      });
    });

    effect(() => {
      const visible = this.popupStore.visible();
      untracked(() => {
        if (!visible) {
          this.clearAllHighlights();
        }
      });
    });

    this.destroyRef.onDestroy(() => this.clearAllHighlights());
  }

  private async highlightGraphic(graphic: Graphic, type: 'hover' | 'selection'): Promise<void> {
    const view = this.viewService.mapView();
    if (!view || !(graphic.layer instanceof FeatureLayer)) return;

    try {
      const layerView = await view.whenLayerView(graphic.layer);
      const handle = layerView.highlight(graphic);

      if (type === 'hover') {
        this.clearHoverHighlight();
        this.hoverHighlight = handle;
      } else {
        this.clearSelectionHighlight();
        this.selectionHighlight = handle;
      }
    } catch (error) {
      throw new PopupHighlightError(error);
    }
  }

  private clearHoverHighlight(): void {
    this.hoverHighlight?.remove();
    this.hoverHighlight = undefined;
  }

  private clearSelectionHighlight(): void {
    this.selectionHighlight?.remove();
    this.selectionHighlight = undefined;
  }

  private clearAllHighlights(): void {
    this.clearHoverHighlight();
    this.clearSelectionHighlight();
  }
}
