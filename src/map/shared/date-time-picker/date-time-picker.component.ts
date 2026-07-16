import { Component, CUSTOM_ELEMENTS_SCHEMA, input, output, signal, OnInit } from '@angular/core';
import '@esri/calcite-components/dist/components/calcite-input-date-picker';
import '@esri/calcite-components/dist/components/calcite-input-time-picker';
import '@esri/calcite-components/dist/components/calcite-button';

@Component({
  selector: 'rima-date-time-picker',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './date-time-picker.component.html',
  styleUrl: './date-time-picker.component.scss',
})
export class DateTimePickerComponent implements OnInit {
  readonly initialValue = input<number | null>(null);

  readonly confirmed = output<number | null>();
  readonly cancelled = output<void>();

  protected readonly selectedDate = signal<string>('');
  protected readonly selectedTime = signal<string>('');

  ngOnInit(): void {
    const value = this.initialValue();
    if (typeof value === 'number' && !Number.isNaN(value)) {
      const date = new Date(value);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      this.selectedDate.set(`${year}-${month}-${day}`);
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      this.selectedTime.set(`${hours}:${minutes}`);
    }
  }

  protected onDateChange(event: Event): void {
    const el = event.target as HTMLElement & { value: string };
    this.selectedDate.set(el.value ?? '');
  }

  protected onTimeChange(event: Event): void {
    const el = event.target as HTMLElement & { value: string };
    this.selectedTime.set(el.value ?? '');
  }

  protected confirm(): void {
    const dateStr = this.selectedDate();
    if (!dateStr) {
      this.confirmed.emit(null);
      return;
    }
    const timeStr = this.selectedTime() || '00:00';
    const timestamp = new Date(`${dateStr}T${timeStr}`).getTime();
    this.confirmed.emit(Number.isNaN(timestamp) ? null : timestamp);
  }

  protected cancel(): void {
    this.cancelled.emit();
  }
}
