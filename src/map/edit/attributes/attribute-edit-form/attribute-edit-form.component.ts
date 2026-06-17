import { Component, computed, CUSTOM_ELEMENTS_SCHEMA, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import Graphic from '@arcgis/core/Graphic';
import { AttributeEditStore } from '../attribute-edit.store';
import { AttributeEditService } from '../attribute-edit.service';
import { EditField } from '../edit-field';
import { ConfirmDialogComponent } from '../../confirm-dialog/confirm-dialog.component';
import '@esri/calcite-components/dist/components/calcite-icon';
import { resolveEditableFields } from '../edit-domain-resolver';

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

  protected readonly editStore = inject(AttributeEditStore);
  private readonly editService = inject(AttributeEditService);

  protected readonly confirmAction = signal<ConfirmAction>(null);

  protected readonly fields = computed<EditField[]>(() => resolveEditableFields(this.graphic()));

  protected getFieldValue(fieldName: string): string | number | boolean | null {
    return this.editStore.editedAttributes()[fieldName] ?? null;
  }

  protected onFieldChange(fieldName: string, event: Event): void {
    const target = event.target as HTMLInputElement | HTMLSelectElement;
    const field = this.fields().find((f) => f.name === fieldName);
    if (!field) return;

    const rawValue = target.value;
    const typedValue = this.castValue(rawValue, field);
    this.editStore.updateField(fieldName, typedValue);
  }

  protected requestSave(): void {
    this.confirmAction.set('save');
  }

  protected requestCancel(): void {
    if (this.editStore.isDirty()) {
      this.confirmAction.set('cancel');
    } else {
      this.editService.cancel();
    }
  }

  protected async onConfirm(confirmed: boolean): Promise<void> {
    const action = this.confirmAction();
    this.confirmAction.set(null);

    if (!confirmed) return;

    if (action === 'save') {
      await this.editService.save();
    } else if (action === 'cancel') {
      this.editService.cancel();
    }
  }

  private castValue(rawValue: string, field: EditField): string | number | null {
    if (rawValue === '') {
      return field.nullable ? null : '';
    }

    switch (field.fieldType) {
      case 'integer':
        return Number.isNaN(Number(rawValue)) ? null : Math.round(Number(rawValue));
      case 'double':
        return Number.isNaN(Number(rawValue)) ? null : Number(rawValue);
      case 'coded-value':
        return this.castCodedValue(rawValue, field);
      case 'string':
      case 'date':
        return rawValue;
    }
  }

  private castCodedValue(rawValue: string, field: EditField): string | number | null {
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
