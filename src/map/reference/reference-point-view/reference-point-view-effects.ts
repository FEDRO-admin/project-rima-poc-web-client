import { effect, inject, Injectable, untracked } from '@angular/core';
import { PopupStore } from '../../popup/popup.store';
import { ReferencePointViewService } from './reference-point-view.service';

@Injectable({
  providedIn: 'root',
})
export class ReferencePointViewEffects {
  private readonly popupStore = inject(PopupStore);
  private readonly refPointViewService = inject(ReferencePointViewService);

  constructor() {
    this.cleanupOnClose();
  }

  private cleanupOnClose(): void {
    effect(() => {
      const visible = this.popupStore.visible();
      untracked(() => {
        if (!visible) {
          this.refPointViewService.cleanup();
        }
      });
    });
  }
}
