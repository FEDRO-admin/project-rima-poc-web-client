import { ChangeDetectorRef, Component, CUSTOM_ELEMENTS_SCHEMA, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import '@esri/calcite-components/dist/components/calcite-button';
import '@esri/calcite-components/dist/components/calcite-input-date-picker';
import '@esri/calcite-components/dist/components/calcite-input-time-picker';
import '@esri/calcite-components/dist/components/calcite-input-text';
import '@esri/calcite-components/dist/components/calcite-loader';
import '@esri/calcite-components/dist/components/calcite-list';
import '@esri/calcite-components/dist/components/calcite-list-item';
import '@esri/calcite-components/dist/components/calcite-notice';
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
  protected panelExpanded = false;
  protected addFormVisible = false;
  protected customExpanded = false;
  protected customDate = '';
  protected customTime = '';
  protected newName = '';
  protected newDate = '';
  protected newTime = '';
  protected errorMessage = '';
  protected confirmingDelete: HistoricMomentEntry | null = null;

  protected async togglePanel(): Promise<void> {
    this.panelExpanded = !this.panelExpanded;
    if (this.panelExpanded && !this.momentsLoaded) {
      await this.loadMoments();
    }
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
    this.customDate = (event.target as HTMLCalciteInputDatePickerElement).value as string;
  }

  protected onCustomTimeChange(event: Event): void {
    this.customTime = (event.target as HTMLCalciteInputTimePickerElement).value as string;
  }

  protected returnToPresent(): void {
    this.selectedMoment = null;
    this.historyStore.deactivate();
  }

  protected confirmDelete(entry: HistoricMomentEntry): void {
    this.confirmingDelete = entry;
  }

  protected cancelDelete(): void {
    this.confirmingDelete = null;
  }

  protected async executeDelete(): Promise<void> {
    if (!this.confirmingDelete) return;
    const name = this.confirmingDelete.name;
    this.confirmingDelete = null;
    this.errorMessage = '';
    const result = await this.historicMomentsService.deleteHistoricMoment(name);
    if (result.success) {
      await this.loadMoments();
    } else {
      this.errorMessage = result.message ?? 'Failed to delete marker';
    }
    this.cdr.detectChanges();
  }

  protected showAddForm(): void {
    this.addFormVisible = true;
    this.errorMessage = '';
  }

  protected cancelAdd(): void {
    this.addFormVisible = false;
    this.newName = '';
    this.newDate = '';
    this.newTime = '';
  }

  protected onNewNameChange(event: Event): void {
    this.newName = (event.target as HTMLCalciteInputTextElement).value;
  }

  protected onNewDateChange(event: Event): void {
    this.newDate = (event.target as HTMLCalciteInputDatePickerElement).value as string;
  }

  protected onNewTimeChange(event: Event): void {
    this.newTime = (event.target as HTMLCalciteInputTimePickerElement).value as string;
  }

  protected async submitAdd(): Promise<void> {
    if (!this.newName || !this.newDate) return;
    this.errorMessage = '';
    const [hour, minute, second] = this.newTime ? this.newTime.split(':').map(Number) : [0, 0, 0];
    const date = new Date(this.newDate);
    date.setHours(hour ?? 0, minute ?? 0, second ?? 0, 0);
    const timestamp = `${date.toISOString().replace('Z', 'Z').slice(0, -1)}Z`;
    const result = await this.historicMomentsService.addHistoricMoment(this.newName, timestamp);
    if (result.success) {
      this.cancelAdd();
      await this.loadMoments();
    } else {
      this.errorMessage = result.message ?? 'Failed to add marker';
    }
    this.cdr.detectChanges();
  }

  protected dismissError(): void {
    this.errorMessage = '';
  }

  private async loadMoments(): Promise<void> {
    this.momentsLoading = true;
    this.moments = await this.historicMomentsService.getHistoricMoments();
    this.momentsLoading = false;
    this.momentsLoaded = true;
    this.cdr.detectChanges();
  }
}
