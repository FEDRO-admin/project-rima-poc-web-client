import { Component, computed, CUSTOM_ELEMENTS_SCHEMA, DestroyRef, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import Graphic from '@arcgis/core/Graphic';
import { AttributeEditStore } from '../attribute-edit.store';
import { AttributeEditService } from '../attribute-edit.service';
import { AttributeEditField } from '../attribute-edit-field';
import { ConfirmDialogComponent } from '../../../../shared/confirm-dialog/confirm-dialog.component';
import '@esri/calcite-components/dist/components/calcite-icon';
import { resolveEditableAttributeFields } from '../../../layer/layer-attribute-domain-resolver';

type ConfirmAction = 'save' | 'cancel' | null;

@Component({
  selector: 'rima-edit-form',
  imports: [FormsModule, ConfirmDialogComponent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './attribute-edit-form.component.html',
  styleUrl: './attribute-edit-form.component.scss',
})
export class AttributeEditFormComponent {
  readonly graphic = input.required<Graphic>();

  protected readonly attributeEditStore = inject(AttributeEditStore);
  private readonly attributeEditService = inject(AttributeEditService);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    this.destroyRef.onDestroy(() => this.attributeEditService.cancel());
  }

  protected readonly confirmAction = signal<ConfirmAction>(null);

  protected readonly fields = computed<AttributeEditField[]>(() => resolveEditableAttributeFields(this.graphic()));

  protected getAttributeFieldValue(fieldName: string): string | number | boolean | null {
    return this.attributeEditStore.editedAttributes()[fieldName] ?? null;
  }

  protected onAttributeFieldChange(fieldName: string, event: Event): void {
    const target = event.target as HTMLInputElement | HTMLSelectElement;
    const field = this.fields().find((f) => f.name === fieldName);
    if (!field) return;

    const rawValue = target.value;
    const typedValue = this.convertValue(rawValue, field);
    this.attributeEditStore.updateField(fieldName, typedValue);
  }

  protected requestSave(): void {
    this.confirmAction.set('save');
  }

  protected requestCancel(): void {
    if (this.attributeEditStore.isDirty()) {
      this.confirmAction.set('cancel');
    } else {
      this.attributeEditService.cancel();
    }
  }

  protected async onConfirm(confirmed: boolean): Promise<void> {
    const action = this.confirmAction();
    this.confirmAction.set(null);

    if (!confirmed) return;

    if (action === 'save') {
      await this.attributeEditService.save();
    } else if (action === 'cancel') {
      this.attributeEditService.cancel();
    }
  }

  // because apparently the HTML input element always returns a string,
  // we need to convert the value back to the appropriate type based on the field definition
  private convertValue(rawValue: string, field: AttributeEditField): string | number | null {
    if (rawValue === '') {
      return field.nullable ? null : '';
    }

    switch (field.fieldType) {
      case 'integer':
        return Number.isNaN(Number(rawValue)) ? null : Math.round(Number(rawValue));
      case 'double':
        return Number.isNaN(Number(rawValue)) ? null : Number(rawValue);
      case 'coded-value':
        return this.convertCodedValue(rawValue, field);
      case 'guid':
      case 'string':
      case 'date':
        return rawValue;
    }
  }

  private convertCodedValue(rawValue: string, field: AttributeEditField): string | number | null {
    // Try to match as a numeric code first
    const numericValue = Number(rawValue);
    if (!Number.isNaN(numericValue)) {
      const match = field.codedValues.find((cv) => cv.code === numericValue);
      if (match) return numericValue;
    }
    // Try as string code
    const stringMatch = field.codedValues.find((cv) => String(cv.code) === rawValue);
    if (stringMatch) return stringMatch.code;
    // Raw value: return as number if numeric, string otherwise
    return Number.isNaN(numericValue) ? rawValue : numericValue;
  }
}
