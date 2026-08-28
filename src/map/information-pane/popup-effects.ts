import { effect, inject, Injectable, untracked } from '@angular/core';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import { PopupService } from './popup.service';
import { PopupStore } from './popup.store';
import { ViewService } from '../view/view.service';
import { ViewStore } from '../view/view.store';

@Injectable({
  providedIn: 'root',
})
export class PopupEffects {
  private readonly viewService = inject(ViewService);
  private readonly viewStore = inject(ViewStore);
  private readonly popupService = inject(PopupService);
  private readonly popupStore = inject(PopupStore);

  constructor() {
    this.attachClickHandler();
    this.closeOnSceneSwitch();
    this.highlightSelected();
    this.highlightHovered();
    this.clearHighlight();
  }

  private attachClickHandler(): void {
    effect(() => {
      const view = this.viewService.activeView();
      untracked(() => {
        if (view) {
          this.popupService.attach(view);
        }
      });
    });
  }

  private closeOnSceneSwitch(): void {
    effect(() => {
      const mode = this.viewStore.mode();
      untracked(() => {
        if (mode !== 'scene' || !this.popupStore.visible()) return;
        const hasNonTransferredGraphic = this.popupStore
          .graphics()
          .some((g) => !(g.layer instanceof FeatureLayer && g.layer.hasZ));
        if (hasNonTransferredGraphic) {
          this.popupStore.close();
        }
      });
    });
  }

  private highlightSelected(): void {
    effect(() => {
      const selectedGraphic = this.popupStore.selectedGraphic();
      untracked(() => {
        if (!selectedGraphic) return;
        this.popupService.clearSelectionHighlight();
        if (selectedGraphic) {
          this.popupService.highlightGraphic(selectedGraphic, 'selection');
        }
      });
    });
  }

  private highlightHovered(): void {
    effect(() => {
      const hoveredIndex = this.popupStore.hoveredIndex();
      untracked(() => {
        this.popupService.clearHoverHighlight();
        if (hoveredIndex != null) {
          const graphic = this.popupStore.graphics()[hoveredIndex];
          if (graphic) {
            this.popupService.highlightGraphic(graphic, 'hover');
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
          this.popupService.clearHoverHighlight();
          this.popupService.clearSelectionHighlight();
        }
      });
    });
  }
}
