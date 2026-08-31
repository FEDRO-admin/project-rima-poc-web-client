import { Component, CUSTOM_ELEMENTS_SCHEMA, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import '@esri/calcite-components/dist/components/calcite-icon';
import { AttributeEditField } from '../attribute-edit-field';
import { AttributeValue, convertAttributeValue, formatDateDisplay } from '../attribute-value-conversion';
import { GuidPickerCandidate, GuidPickerService } from '../guid-picker.service';
import { DateTimePickerComponent } from '../date-time-picker/date-time-picker.component';

@Component({
  selector: 'rima-attribute-form',
  imports: [FormsModule, DateTimePickerComponent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './attribute-form.component.html',
  styleUrl: './attribute-form.component.scss',
  providers: [GuidPickerService],
})
export class AttributeFormComponent {
  readonly fields = input.required<AttributeEditField[]>();
  readonly values = input.required<Record<string, AttributeValue>>();
  readonly disabled = input<boolean>(false);
  readonly idPrefix = input<string>('attr');
  readonly showRequiredIndicator = input<boolean>(false);

  readonly fieldChange = output<{ fieldName: string; value: AttributeValue }>();

  protected readonly guidPickerService = inject(GuidPickerService);
  protected readonly activeDateField = signal<string | null>(null);

  protected getFieldValue(fieldName: string): AttributeValue {
    return this.values()[fieldName] ?? null;
  }

  protected getDateValue(fieldName: string): number | null {
    const value = this.values()[fieldName] ?? null;
    return typeof value === 'number' ? value : null;
  }

  protected getDateDisplayValue(fieldName: string): string {
    const value = this.values()[fieldName] ?? null;
    return formatDateDisplay(value);
  }

  protected openDatePicker(fieldName: string): void {
    if (!this.disabled()) {
      this.activeDateField.set(fieldName);
    }
  }

  protected onDateConfirmed(fieldName: string, value: number | null): void {
    this.fieldChange.emit({ fieldName, value });
    this.activeDateField.set(null);
  }

  protected cancelDatePicker(): void {
    this.activeDateField.set(null);
  }

  protected onFieldChange(fieldName: string, event: Event): void {
    const target = event.target as HTMLInputElement | HTMLSelectElement;
    const field = this.fields().find((f) => f.name === fieldName);
    if (!field) return;

    const rawValue = target.value;
    const typedValue = convertAttributeValue(rawValue, field);
    this.fieldChange.emit({ fieldName, value: typedValue });
  }

  protected startGuidPick(fieldName: string): void {
    this.guidPickerService.startPicking(fieldName);
  }

  protected selectGuidCandidate(candidate: GuidPickerCandidate): void {
    const result = this.guidPickerService.confirmSelection(candidate);
    if (result) {
      this.fieldChange.emit({ fieldName: result.fieldName, value: result.value });
    }
  }

  protected cancelGuidPick(): void {
    this.guidPickerService.cancel();
  }
}
