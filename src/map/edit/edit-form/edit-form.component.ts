import { Component, computed, CUSTOM_ELEMENTS_SCHEMA, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import Graphic from '@arcgis/core/Graphic';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import { EditStore } from '../edit.store';
import { EditService } from '../edit.service';
import { GeometryEditService } from '../geometry/geometry-edit.service';
import { EditField } from '../edit-field';
import { resolveEditableFieldsForSubtype } from '../edit-domain-resolver';
import { ConfirmDialogComponent } from '../confirm-dialog/confirm-dialog.component';
import '@esri/calcite-components/dist/components/calcite-icon';

type ConfirmAction = 'save' | 'cancel' | null;

@Component({
  selector: 'rima-edit-form',
  imports: [FormsModule, ConfirmDialogComponent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './edit-form.component.html',
  styleUrl: './edit-form.component.scss',
})
export class EditFormComponent {
  readonly graphic = input.required<Graphic>();

  protected readonly editStore = inject(EditStore);
  private readonly editService = inject(EditService);
  protected readonly geometryEditService = inject(GeometryEditService);

  protected readonly confirmAction = signal<ConfirmAction>(null);
  protected readonly rawInputFields = signal<Set<string>>(new Set());

  protected readonly fields = computed<EditField[]>(() => {
    const graphic = this.graphic();
    const editedAttrs = this.editStore.editedAttributes();
    const layer = graphic.layer;

    if (!(layer instanceof FeatureLayer)) {
      return [];
    }

    const rawSubtype = layer.typeIdField ? (editedAttrs[layer.typeIdField] ?? null) : null;
    const subtypeValue = typeof rawSubtype === 'boolean' ? null : rawSubtype;
    return resolveEditableFieldsForSubtype(graphic, subtypeValue);
  });

  protected readonly supportsGeometryUpdate = computed(() => {
    const graphic = this.graphic();
    const layer = graphic.layer;
    if (!(layer instanceof FeatureLayer)) return false;
    return layer.capabilities?.editing?.supportsGeometryUpdate ?? false;
  });

  protected getFieldValue(fieldName: string): string | number | boolean | null {
    return this.editStore.editedAttributes()[fieldName] ?? null;
  }

  protected onFieldChange(fieldName: string, event: Event): void {
    const target = event.target as HTMLInputElement | HTMLSelectElement;
    const field = this.fields().find((f) => f.name === fieldName);
    if (!field) return;

    const rawValue = target.value;
    const typedValue = this.coerceValue(rawValue, field);
    this.editStore.updateField(fieldName, typedValue);
  }

  protected onSubtypeChange(fieldName: string, event: Event): void {
    const target = event.target as HTMLSelectElement;
    const rawValue = target.value;
    const numericValue = rawValue === '' ? null : Number(rawValue);
    this.editStore.updateField(fieldName, numericValue);
  }

  protected isRawInput(fieldName: string): boolean {
    return this.rawInputFields().has(fieldName);
  }

  protected toggleRawInput(fieldName: string): void {
    const current = this.rawInputFields();
    const next = new Set(current);
    if (next.has(fieldName)) {
      next.delete(fieldName);
    } else {
      next.add(fieldName);
    }
    this.rawInputFields.set(next);
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

  protected toggleGeometryEditing(): void {
    if (this.editStore.geometryEditing()) {
      this.geometryEditService.deactivate();
    } else {
      this.geometryEditService.activate(this.graphic());
    }
  }

  protected undoGeometry(): void {
    this.geometryEditService.undo();
  }

  protected redoGeometry(): void {
    this.geometryEditService.redo();
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

  private coerceValue(rawValue: string, field: EditField): string | number | null {
    if (rawValue === '') {
      return field.nullable ? null : '';
    }

    switch (field.fieldType) {
      case 'integer':
        return Number.isNaN(Number(rawValue)) ? null : Math.round(Number(rawValue));
      case 'double':
        return Number.isNaN(Number(rawValue)) ? null : Number(rawValue);
      case 'coded-value':
        return this.coerceCodedValue(rawValue, field);
      case 'string':
      case 'date':
      case 'subtype':
        return rawValue;
    }
  }

  private coerceCodedValue(rawValue: string, field: EditField): string | number | null {
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
