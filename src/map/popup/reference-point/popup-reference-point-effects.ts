import { effect, inject, Injectable, untracked } from '@angular/core';
import { PopupStore } from '../popup.store';
import { PopupReferencePointService } from './popup-reference-point.service';

@Injectable({
  providedIn: 'root',
})
export class PopupReferencePointEffects {
  private readonly popupStore = inject(PopupStore);
  private readonly popupRefPointService = inject(PopupReferencePointService);

  constructor() {
    this.resolveAndLoadOnSelection();
    this.cleanupOnClose();
  }

  private resolveAndLoadOnSelection(): void {
    effect(() => {
      const graphic = this.popupStore.selectedGraphic();
      untracked(() => {
        this.popupRefPointService.cleanup();
        if (graphic) {
          this.popupRefPointService.resolveForGraphic(graphic);
          this.popupRefPointService.loadPoints(graphic);
        }
      });
    });
  }

  private cleanupOnClose(): void {
    effect(() => {
      const visible = this.popupStore.visible();
      untracked(() => {
        if (!visible) {
          this.popupRefPointService.cleanup();
        }
      });
    });
  }
}
