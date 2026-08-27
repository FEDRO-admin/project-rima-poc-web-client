import { effect, inject, Injectable, untracked } from '@angular/core';
import { ViewStore } from './view.store';

@Injectable({
  providedIn: 'root',
})
export class ViewEffects {
  private readonly viewStore = inject(ViewStore);

  constructor() {
    this.resetOnViewModeSwitch();
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

  private resetOnHistoricDateChange(): void {
    effect(() => {
      this.viewStore.historicDate();
      untracked(() => {
        this.viewStore.setInteractionMode('idle');
      });
    });
  }
}
