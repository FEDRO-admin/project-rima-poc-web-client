import { effect, inject, Injectable, untracked } from '@angular/core';
import { PopupService } from './popup.service';
import { PopupStore } from './popup.store';
import { ViewService } from '../view/view.service';

@Injectable({
  providedIn: 'root',
})
export class PopupEffects {
  private readonly viewService = inject(ViewService);
  private readonly popupService = inject(PopupService);
  private readonly popupStore = inject(PopupStore);

  constructor() {
    this.attachClickHandler();
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
