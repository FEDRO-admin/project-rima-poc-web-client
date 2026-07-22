import { effect, inject, Injectable, untracked } from '@angular/core';
import { ViewStore } from './view.store';
import { PopupStore } from '../popup/popup.store';
import { CreateStore } from '../create/create.store';
import { HistoryStore } from '../history/history.store';
import { EditStore } from '../edit/edit.store';

@Injectable({
  providedIn: 'root',
})
export class ViewEffects {
  private readonly viewStore = inject(ViewStore);
  private readonly popupStore = inject(PopupStore);
  private readonly editStore = inject(EditStore);
  private readonly createStore = inject(CreateStore);
  private readonly historyStore = inject(HistoryStore);

  constructor() {
    this.cancelActiveModesOnSwitch();
  }

  private cancelActiveModesOnSwitch(): void {
    effect(() => {
      this.viewStore.mode();
      untracked(() => {
        this.popupStore.close();

        if (this.editStore.active()) {
          this.editStore.reset();
        }

        if (this.createStore.active()) {
          this.createStore.reset();
        }

        if (this.historyStore.active()) {
          this.historyStore.reset();
        }
      });
    });
  }
}
