import { Component, CUSTOM_ELEMENTS_SCHEMA, inject } from '@angular/core';
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

  protected async togglePanel(): Promise<void> {
    const expanded = !this.historyStore.panelExpanded();
    this.historyStore.setPanelExpanded(expanded);
    if (expanded && this.historyStore.momentsState() === undefined) {
      await this.loadMoments();
    }
  }

  protected selectMoment(entry: HistoricMomentEntry): void {
    const date = new Date(entry.date);
    this.historyStore.setSelectedMoment(entry);
    this.historyStore.activate(date);
    this.historyService.applyHistoricMoment(date);
  }

  protected applyCustomDate(): void {
    const customDate = this.historyStore.customDate();
    if (!customDate) return;
    const customTime = this.historyStore.customTime();
    const [hour, minute] = customTime ? customTime.split(':').map(Number) : [0, 0];
    const date = new Date(customDate);
    date.setHours(hour, minute, 0, 0);
    this.historyStore.setSelectedMoment(null);
    this.historyStore.activate(date);
    this.historyService.applyHistoricMoment(date);
  }

  protected onCustomDateChange(event: Event): void {
    this.historyStore.setCustomDate((event.target as HTMLCalciteInputDatePickerElement).value as string);
  }

  protected onCustomTimeChange(event: Event): void {
    this.historyStore.setCustomTime((event.target as HTMLCalciteInputTimePickerElement).value as string);
  }

  protected returnToPresent(): void {
    this.historyStore.setSelectedMoment(null);
    this.historyStore.deactivate();
  }

  protected confirmDelete(entry: HistoricMomentEntry): void {
    this.historyStore.setConfirmingDelete(entry);
  }

  protected cancelDelete(): void {
    this.historyStore.setConfirmingDelete(null);
  }

  protected async executeDelete(): Promise<void> {
    const entry = this.historyStore.confirmingDelete();
    if (!entry) return;
    const name = entry.name;
    this.historyStore.setConfirmingDelete(null);
    this.historyStore.setErrorMessage('');
    const result = await this.historicMomentsService.deleteHistoricMoment(name);
    if (result.success) {
      await this.loadMoments();
    } else {
      this.historyStore.setErrorMessage(result.message ?? 'Failed to delete marker');
    }
  }

  protected showAddForm(): void {
    this.historyStore.setAddFormVisible(true);
    this.historyStore.setErrorMessage('');
  }

  protected cancelAdd(): void {
    this.historyStore.setAddFormVisible(false);
    this.historyStore.setNewName('');
    this.historyStore.setNewDate('');
    this.historyStore.setNewTime('');
  }

  protected onNewNameChange(event: Event): void {
    this.historyStore.setNewName((event.target as HTMLCalciteInputTextElement).value);
  }

  protected onNewDateChange(event: Event): void {
    this.historyStore.setNewDate((event.target as HTMLCalciteInputDatePickerElement).value as string);
  }

  protected onNewTimeChange(event: Event): void {
    this.historyStore.setNewTime((event.target as HTMLCalciteInputTimePickerElement).value as string);
  }

  protected async submitAdd(): Promise<void> {
    const newName = this.historyStore.newName();
    const newDate = this.historyStore.newDate();
    const newTime = this.historyStore.newTime();
    if (!newName || !newDate) return;
    this.historyStore.setErrorMessage('');
    const [hour, minute, second] = newTime ? newTime.split(':').map(Number) : [0, 0, 0];
    const date = new Date(newDate);
    date.setHours(hour ?? 0, minute ?? 0, second ?? 0, 0);
    const timestamp = `${date.toISOString().slice(0, -1)}Z`;
    const result = await this.historicMomentsService.addHistoricMoment(newName, timestamp);
    if (result.success) {
      this.cancelAdd();
      await this.loadMoments();
    } else {
      this.historyStore.setErrorMessage(result.message ?? 'Failed to add marker');
    }
  }

  protected dismissError(): void {
    this.historyStore.setErrorMessage('');
  }

  protected toggleCustomPanel(): void {
    this.historyStore.setCustomExpanded(!this.historyStore.customExpanded());
  }

  private async loadMoments(): Promise<void> {
    this.historyStore.setMomentsLoading();
    const moments = await this.historicMomentsService.getHistoricMoments();
    this.historyStore.setMoments(moments);
  }
}
