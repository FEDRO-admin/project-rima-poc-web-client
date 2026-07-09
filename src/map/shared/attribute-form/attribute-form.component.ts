import { Component, CUSTOM_ELEMENTS_SCHEMA, effect, inject, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import '@esri/calcite-components/dist/components/calcite-icon';
import { AttributeEditField } from '../attribute-edit-field';
import { AttributeValue, convertAttributeValue } from '../attribute-value-conversion';
import { GuidPickerCandidate, GuidPickerService } from '../guid-picker.service';

@Component({
  selector: 'rima-attribute-form',
  imports: [FormsModule],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './attribute-form.component.html',
  styleUrl: './attribute-form.component.scss',
})
export class AttributeFormComponent {
  readonly fields = input.required<AttributeEditField[]>();
  readonly values = input.required<Record<string, AttributeValue>>();
  readonly disabled = input<boolean>(false);
  readonly idPrefix = input<string>('attr');
  readonly showRequiredIndicator = input<boolean>(false);

  readonly fieldChange = output<{ fieldName: string; value: AttributeValue }>();

  protected readonly guidPickerService = inject(GuidPickerService);

  constructor() {
    effect(() => {
      const selection = this.guidPickerService.lastSelection();
      if (selection) {
        this.fieldChange.emit({ fieldName: selection.fieldName, value: selection.value });
      }
    });
  }

  protected getFieldValue(fieldName: string): AttributeValue {
    return this.values()[fieldName] ?? null;
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
    this.guidPickerService.confirmSelection(candidate);
  }

  protected cancelGuidPick(): void {
    this.guidPickerService.cancel();
  }
}
