import { effect, inject, Injectable, untracked } from '@angular/core';
import { DeleteStore } from './delete.store';
import { ViewStore } from '../view/view.store';

@Injectable({
  providedIn: 'root',
})
export class DeleteEffects {
  private readonly deleteStore = inject(DeleteStore);
  private readonly viewStore = inject(ViewStore);

  constructor() {
    this.resetModeOnDeactivate();
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
}
