import { effect, inject, Injectable, untracked } from '@angular/core';
import { HistoryStore } from './history.store';
import { HistoryService } from './history.service';
import { PopupStore } from '../information-pane/popup.store';
import { PopupService } from '../information-pane/popup.service';

@Injectable({
  providedIn: 'root',
})
export class HistoryEffects {
  private readonly historyStore = inject(HistoryStore);
  private readonly historyService = inject(HistoryService);
  private readonly popupStore = inject(PopupStore);
  private readonly popupService = inject(PopupService);

  constructor() {
    this.refreshPopupOnDateChange();
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
