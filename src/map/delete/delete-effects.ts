import { effect, inject, Injectable, untracked } from '@angular/core';
import { DeleteStore } from './delete.store';
import { ViewStore } from '../view/view.store';
import { PopupStore } from '../information-pane/popup.store';

@Injectable({
  providedIn: 'root',
})
export class DeleteEffects {
  private readonly deleteStore = inject(DeleteStore);
  private readonly viewStore = inject(ViewStore);
  private readonly popupStore = inject(PopupStore);

  constructor() {
    this.resetModeOnDeactivate();
    this.cancelOnPopupClose();
  }

  private resetModeOnDeactivate(): void {
    effect(() => {
      const active = this.deleteStore.active();
      untracked(() => {
        if (!active && this.viewStore.interactionMode() === 'deleting') {
          this.viewStore.setInteractionMode('idle');
        }
      });
    });
  }

  private cancelOnPopupClose(): void {
    effect(() => {
      const visible = this.popupStore.visible();
      untracked(() => {
        if (!visible && this.deleteStore.active()) {
          this.deleteStore.reset();
        }
      });
    });
  }
}
