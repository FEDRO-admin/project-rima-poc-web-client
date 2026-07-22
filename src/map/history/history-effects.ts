import { computed, effect, inject, Injectable, untracked } from '@angular/core';
import { HistoryStore } from './history.store';
import { HistoryService } from './history.service';
import { PopupStore } from '../popup/popup.store';
import { PopupService } from '../popup/popup.service';
import { EditStore } from '../edit/edit.store';
import { CreateStore } from '../create/create.store';

@Injectable({
  providedIn: 'root',
})
export class HistoryEffects {
  private readonly historyStore = inject(HistoryStore);
  private readonly historyService = inject(HistoryService);
  private readonly popupStore = inject(PopupStore);
  private readonly popupService = inject(PopupService);
  private readonly editStore = inject(EditStore);
  private readonly createStore = inject(CreateStore);

  constructor() {
    this.refreshPopupOnDateChange();
    this.cancelEditsOnActivate();
    this.cancelCreateOnActivate();
    this.clearHistoricMomentOnDeactivate();
  }

  private refreshPopupOnDateChange(): void {
    effect(() => {
      this.historyStore.selectedDate();
      untracked(() => {
        if (this.popupStore.visible() && this.popupStore.selectedGraphic()) {
          this.popupService.refreshSelectedGraphic();
        }
      });
    });
  }

  private cancelEditsOnActivate(): void {
    effect(() => {
      const active = this.historyStore.active();
      untracked(() => {
        if (active && this.editStore.active()) {
          this.editStore.reset();
        }
      });
    });
  }

  private cancelCreateOnActivate(): void {
    effect(() => {
      const active = this.historyStore.active();
      untracked(() => {
        if (active && this.createStore.active()) {
          this.createStore.reset();
        }
      });
    });
  }

  private clearHistoricMomentOnDeactivate(): void {
    effect(() => {
      const active = this.historyStore.active();
      untracked(() => {
        if (!active) {
          this.historyService.clearHistoricMoment();
        }
      });
    });
  }
}
