import { Component, CUSTOM_ELEMENTS_SCHEMA, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import '@esri/calcite-components/dist/components/calcite-button';
import '@esri/calcite-components/dist/components/calcite-dropdown';
import '@esri/calcite-components/dist/components/calcite-dropdown-group';
import '@esri/calcite-components/dist/components/calcite-dropdown-item';
import { HistoryStore } from '../history.store';
import { HistoryService } from '../history.service';
import { HISTORIC_MOMENTS, HistoricMomentEntry } from '../history-config';

@Component({
  selector: 'rima-history-picker',
  imports: [DatePipe],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './history-picker.component.html',
  styleUrl: './history-picker.component.scss',
})
export class HistoryPickerComponent {
  protected readonly historyStore = inject(HistoryStore);
  private readonly historyService = inject(HistoryService);
  protected readonly moments = HISTORIC_MOMENTS;
  protected selectedMoment: HistoricMomentEntry | null = null;

  protected selectMoment(entry: HistoricMomentEntry): void {
    const date = new Date(entry.date);
    this.selectedMoment = entry;
    this.historyStore.activate(date);
    this.historyService.applyHistoricMoment(date);
  }

  protected returnToPresent(): void {
    this.selectedMoment = null;
    this.historyStore.deactivate();
  }

  protected isSelected(entry: HistoricMomentEntry): boolean {
    return this.selectedMoment === entry;
  }
}
