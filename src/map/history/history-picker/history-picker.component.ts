import { ChangeDetectorRef, Component, CUSTOM_ELEMENTS_SCHEMA, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import '@esri/calcite-components/dist/components/calcite-button';
import '@esri/calcite-components/dist/components/calcite-dropdown';
import '@esri/calcite-components/dist/components/calcite-dropdown-group';
import '@esri/calcite-components/dist/components/calcite-dropdown-item';
import '@esri/calcite-components/dist/components/calcite-input-date-picker';
import '@esri/calcite-components/dist/components/calcite-input-time-picker';
import '@esri/calcite-components/dist/components/calcite-loader';
import { HistoryStore } from '../history.store';
import { HistoryService } from '../history.service';
import { HistoricMomentEntry } from '../history-config';
import { HistoricMomentsService } from '../historic-moments.service';

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
  private readonly historicMomentsService = inject(HistoricMomentsService);
  private readonly cdr = inject(ChangeDetectorRef);
  protected moments: HistoricMomentEntry[] = [];
  protected momentsLoaded = false;
  protected momentsLoading = false;
  protected selectedMoment: HistoricMomentEntry | null = null;
  protected customExpanded = false;
  protected customDate = '';
  protected customTime = '';

  protected async onDropdownOpen(): Promise<void> {
    if (this.momentsLoaded) return;
    this.momentsLoading = true;
    this.moments = await this.historicMomentsService.getHistoricMoments();
    this.momentsLoading = false;
    this.momentsLoaded = true;
    this.cdr.detectChanges();
  }

  protected selectMoment(entry: HistoricMomentEntry): void {
    const date = new Date(entry.date);
    this.selectedMoment = entry;
    this.historyStore.activate(date);
    this.historyService.applyHistoricMoment(date);
  }

  protected applyCustomDate(): void {
    if (!this.customDate) return;
    const [hour, minute] = this.customTime ? this.customTime.split(':').map(Number) : [0, 0];
    const date = new Date(this.customDate);
    date.setHours(hour, minute, 0, 0);
    this.selectedMoment = null;
    this.historyStore.activate(date);
    this.historyService.applyHistoricMoment(date);
  }

  protected onCustomDateChange(event: Event): void {
    const el = event.target as HTMLCalciteInputDatePickerElement;
    this.customDate = el.value as string;
  }

  protected onCustomTimeChange(event: Event): void {
    const el = event.target as HTMLCalciteInputTimePickerElement;
    this.customTime = el.value as string;
  }

  protected returnToPresent(): void {
    this.selectedMoment = null;
    this.historyStore.deactivate();
  }

  protected isSelected(entry: HistoricMomentEntry): boolean {
    return this.selectedMoment === entry;
  }
}
