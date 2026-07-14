import { Component, CUSTOM_ELEMENTS_SCHEMA, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import '@esri/calcite-components/dist/components/calcite-button';
import '@esri/calcite-components/dist/components/calcite-dialog';
import '@esri/calcite-components/dist/components/calcite-input-date-picker';
import '@esri/calcite-components/dist/components/calcite-input-time-picker';
import '@esri/calcite-components/dist/components/calcite-input-text';
import '@esri/calcite-components/dist/components/calcite-loader';
import '@esri/calcite-components/dist/components/calcite-list';
import '@esri/calcite-components/dist/components/calcite-list-item';
import '@esri/calcite-components/dist/components/calcite-notice';
import { HistoryStore } from '../history.store';
import { HistoryService } from '../history.service';
import { HistoryEntry } from '../history-entry';

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

  protected readonly panelExpanded = signal(false);
  protected readonly customExpanded = signal(false);
  protected readonly addFormVisible = signal(false);
  protected readonly customDate = signal('');
  protected readonly customTime = signal('');
  protected readonly newName = signal('');
  protected readonly newDate = signal('');
  protected readonly newTime = signal('');

  protected async togglePanel(): Promise<void> {
    const expanded = !this.panelExpanded();
    this.panelExpanded.set(expanded);
    if (expanded) {
      this.customExpanded.set(false);
      if (this.historyStore.momentsState() === undefined) {
        await this.historyService.loadMoments();
      }
    }
  }

  protected selectMoment(entry: HistoryEntry): void {
    this.historyStore.setSelectedMoment(entry);
  }

  protected applySelectedMoment(): void {
    const entry = this.historyStore.selectedMoment();
    if (!entry) return;
    this.historyService.applyDate(new Date(entry.date));
    this.panelExpanded.set(false);
  }

  protected applyCustomDate(): void {
    const customDate = this.customDate();
    if (!customDate) return;
    const customTime = this.customTime();
    const [hour, minute] = customTime ? customTime.split(':').map(Number) : [0, 0];
    const date = new Date(customDate);
    date.setHours(hour, minute, 0, 0);
    this.historyService.applyDate(date);
    this.customExpanded.set(false);
  }

  protected onCustomDateChange(event: Event): void {
    this.customDate.set((event.target as HTMLCalciteInputDatePickerElement).value as string);
  }

  protected onCustomTimeChange(event: Event): void {
    this.customTime.set((event.target as HTMLCalciteInputTimePickerElement).value as string);
  }

  protected returnToPresent(): void {
    this.historyService.clearHistoricMoment();
  }

  protected confirmDelete(entry: HistoryEntry): void {
    this.historyStore.setConfirmingDelete(entry);
  }

  protected cancelDelete(): void {
    this.historyStore.setConfirmingDelete(null);
  }

  protected async executeDelete(): Promise<void> {
    const entry = this.historyStore.confirmingDelete();
    if (!entry) return;
    await this.historyService.executeDelete(entry);
  }

  protected showAddForm(): void {
    this.addFormVisible.set(true);
    this.historyStore.setErrorMessage('');
  }

  protected cancelAdd(): void {
    this.addFormVisible.set(false);
    this.newName.set('');
    this.newDate.set('');
    this.newTime.set('');
  }

  protected onNewNameChange(event: Event): void {
    this.newName.set((event.target as HTMLCalciteInputTextElement).value);
  }

  protected onNewDateChange(event: Event): void {
    this.newDate.set((event.target as HTMLCalciteInputDatePickerElement).value as string);
  }

  protected onNewTimeChange(event: Event): void {
    this.newTime.set((event.target as HTMLCalciteInputTimePickerElement).value as string);
  }

  protected async submitAdd(): Promise<void> {
    const name = this.newName();
    const dateStr = this.newDate();
    const timeStr = this.newTime();
    if (!name || !dateStr) return;
    const [hour, minute, second] = timeStr ? timeStr.split(':').map(Number) : [0, 0, 0];
    const date = new Date(dateStr);
    date.setHours(hour ?? 0, minute ?? 0, second ?? 0, 0);
    const success = await this.historyService.submitAdd(name, date);
    if (success) {
      this.addFormVisible.set(false);
      this.newName.set('');
      this.newDate.set('');
      this.newTime.set('');
    }
  }

  protected dismissError(): void {
    this.historyStore.setErrorMessage('');
  }

  protected toggleCustomPanel(): void {
    const expanded = !this.customExpanded();
    this.customExpanded.set(expanded);
    if (expanded) {
      this.panelExpanded.set(false);
    }
  }

  protected closeMomentsDialog(): void {
    this.panelExpanded.set(false);
  }

  protected closeCustomDialog(): void {
    this.customExpanded.set(false);
  }
}
