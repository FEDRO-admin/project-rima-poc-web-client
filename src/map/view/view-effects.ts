import { effect, inject, Injectable, untracked } from '@angular/core';
import { ViewStore } from './view.store';
import { PopupStore } from '../popup/popup.store';

@Injectable({
  providedIn: 'root',
})
export class ViewEffects {
  private readonly viewStore = inject(ViewStore);
  private readonly popupStore = inject(PopupStore);

  constructor() {
    this.resetOnViewModeSwitch();
    this.closePopupOnLock();
    this.resetOnHistoricDateChange();
  }

  private resetOnViewModeSwitch(): void {
    effect(() => {
      this.viewStore.mode();
      untracked(() => {
        this.viewStore.setInteractionMode('idle');
      });
    });
  }

  private closePopupOnLock(): void {
    effect(() => {
      const mode = this.viewStore.interactionMode();
      untracked(() => {
        if (mode === 'editing' || mode === 'creating') {
          this.popupStore.close();
        }
      });
    });
  }

  private resetOnHistoricDateChange(): void {
    effect(() => {
      this.viewStore.historicDate();
      untracked(() => {
        this.viewStore.setInteractionMode('idle');
        this.popupStore.close();
      });
    });
  }
}
