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
    effect(() => {
      const view = this.viewService.mapView();
      untracked(() => {
        this.attachClickHandler(view);
      });
    });

    effect(() => {
      const selectedGraphic = this.popupStore.selectedGraphic();
      untracked(() => {
        this.highlightSelected(selectedGraphic);
      });
    });

    effect(() => {
      const hoveredIndex = this.popupStore.hoveredIndex();
      untracked(() => {
        this.highlightHovered(hoveredIndex);
      });
    });

    effect(() => {
      const visible = this.popupStore.visible();
      untracked(() => {
        this.toggleVisibleHighlight(visible);
      });
    });
  }

  private attachClickHandler(view: MapView | undefined): void {
    if (view) {
      this.popupClickService.attach(view);
    }
  }

  private highlightSelected(graphic: Graphic | undefined): void {
    if (!graphic) return;
    this.popupHighlightService.clearSelectionHighlight();
    if (graphic) {
      this.popupHighlightService.highlightGraphic(graphic, 'selection');
    }
  }

  private highlightHovered(index: number | undefined): void {
    this.popupHighlightService.clearHoverHighlight();
    if (index != null) {
      const graphic = this.popupStore.graphics()[index];
      if (graphic) {
        this.popupHighlightService.highlightGraphic(graphic, 'hover');
      }
    }
  }

  private toggleVisibleHighlight(visible: boolean): void {
    if (!visible) {
      this.popupHighlightService.clearHoverHighlight();
      this.popupHighlightService.clearSelectionHighlight();
    }
  }
}
