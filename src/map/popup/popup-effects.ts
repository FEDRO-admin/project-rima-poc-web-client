import { effect, inject, Injectable, untracked } from '@angular/core';
import { PopupClickService } from './popup-click.service';
import { PopupHighlightService } from './popup-highlight.service';
import { PopupStore } from './popup.store';
import { MapViewService } from '../view/view.service';
import Graphic from '@arcgis/core/Graphic';
import MapView from '@arcgis/core/views/MapView';

@Injectable({
  providedIn: 'root',
})
export class PopupEffects {
  private readonly viewService = inject(MapViewService);
  private readonly popupStore = inject(PopupStore);
  private readonly popupClickService = inject(PopupClickService);
  private readonly popupHighlightService = inject(PopupHighlightService);

  constructor() {
    this.attachClickHandler();
    this.highlightSelected();
    this.highlightHovered();
    this.clearHighlight();
  }

  private attachClickHandler(): void {
    effect(() => {
      const view = this.viewService.mapView();
      untracked(() => {
        if (view) {
          this.popupClickService.attach(view);
        }
      });
    });
  }

  private highlightSelected(): void {
    effect(() => {
      const selectedGraphic = this.popupStore.selectedGraphic();
      untracked(() => {
        if (!selectedGraphic) return;
        this.popupHighlightService.clearSelectionHighlight();
        if (selectedGraphic) {
          this.popupHighlightService.highlightGraphic(selectedGraphic, 'selection');
        }
      });
    });
  }

  private highlightHovered(): void {
    effect(() => {
      const hoveredIndex = this.popupStore.hoveredIndex();
      untracked(() => {
        this.popupHighlightService.clearHoverHighlight();
        if (hoveredIndex != null) {
          const graphic = this.popupStore.graphics()[hoveredIndex];
          if (graphic) {
            this.popupHighlightService.highlightGraphic(graphic, 'hover');
          }
        }
      });
    });
  }

  private clearHighlight(): void {
    effect(() => {
      const visible = this.popupStore.visible();
      untracked(() => {
        if (!visible) {
          this.popupHighlightService.clearHoverHighlight();
          this.popupHighlightService.clearSelectionHighlight();
        }
      });
    });
  }
}
