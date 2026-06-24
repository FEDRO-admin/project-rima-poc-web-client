import { Component, computed, CUSTOM_ELEMENTS_SCHEMA, DestroyRef, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import type { CreateTool } from '@arcgis/core/widgets/Sketch/types';
import { CreateStore } from '../create.store';
import { CreateGeometryService } from '../create-geometry.service';
import { AttributeEditField } from '../../edit/attributes/attribute-edit-field';
import { resolveCreatableFields, buildDefaultAttributes } from '../create-attribute.service';
import { DrawingToolOption, getDrawingToolsForGeometryType } from '../create-config';
import { ConfirmDialogComponent } from '../../../shared/confirm-dialog/confirm-dialog.component';
import '@esri/calcite-components/dist/components/calcite-icon';
import { CreateService } from '../create.service';
import { PopupStore } from '../../popup/popup.store';
import { CreateFormLoadError as SaveAndOpenPopupError } from '../create-errors';

type ConfirmAction = 'save' | 'cancel' | null;

@Component({
  selector: 'rima-create-form',
  imports: [FormsModule, ConfirmDialogComponent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './create-form.component.html',
  styleUrl: './create-form.component.scss',
})
export class CreateFormComponent {
  readonly layer = input.required<FeatureLayer>();

  protected readonly createStore = inject(CreateStore);
  private readonly createGeometryService = inject(CreateGeometryService);
  private readonly createService = inject(CreateService);
  private readonly popupStore = inject(PopupStore);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly confirmAction = signal<ConfirmAction>(null);

  protected readonly activeTool = signal<CreateTool | undefined>(undefined);

  constructor() {
    this.destroyRef.onDestroy(() => this.createGeometryService.cancel());
  }

  protected readonly fields = computed<AttributeEditField[]>(() => {
    const layer = this.layer();
    const subtype = this.createStore.subtypeValue();
    return resolveCreatableFields(layer, subtype);
  });

  protected readonly drawingTools = computed<DrawingToolOption[]>(() => {
    return getDrawingToolsForGeometryType(this.layer().geometryType);
  });

  protected readonly canSave = computed<boolean>(() => {
    const hasGeometry = this.createStore.geometry() != null;
    const notSaving = !this.createStore.saving();
    return hasGeometry && notSaving;
  });

  initializeForm(): void {
    const layer = this.layer();
    const subtypeValue = this.createStore.subtypeValue();
    const fields = resolveCreatableFields(layer, subtypeValue);
    const defaults = buildDefaultAttributes(layer, fields);
    this.createStore.setAttributes(defaults);
  }

  protected getFieldValue(fieldName: string): string | number | boolean | null {
    return this.createStore.attributes()[fieldName] ?? null;
  }

  protected onFieldChange(fieldName: string, event: Event): void {
    const target = event.target as HTMLInputElement | HTMLSelectElement;
    const field = this.fields().find((f) => f.name === fieldName);
    if (!field) return;

    const rawValue = target.value;
    const typedValue = this.convertValue(rawValue, field);
    this.createStore.updateField(fieldName, typedValue);
  }

  protected selectTool(tool: CreateTool): void {
    this.activeTool.set(tool);
    this.createGeometryService.startDrawing(this.layer(), tool);
  }

  protected clearGeometry(): void {
    this.createGeometryService.cancel();
    this.createStore.updateGeometry(undefined!);
    this.activeTool.set(undefined);
  }

  protected confirmPlacement(): void {
    this.createGeometryService.confirmPlacement();
  }

  protected editGeometry(): void {
    this.createGeometryService.reenterAdjusting();
  }

  protected undo(): void {
    this.createGeometryService.undo();
  }

  protected redo(): void {
    this.createGeometryService.redo();
  }

  protected requestSave(): void {
    this.confirmAction.set('save');
  }

  protected requestCancel(): void {
    if (this.createStore.isDirty()) {
      this.confirmAction.set('cancel');
    } else {
      this.createGeometryService.cancel();
      this.createStore.reset();
    }
  }

  protected async onConfirm(confirmed: boolean): Promise<void> {
    const action = this.confirmAction();
    this.confirmAction.set(null);

    if (!confirmed) return;

    if (action === 'save') {
      await this.saveAndOpenInPopup();
    } else if (action === 'cancel') {
      this.createGeometryService.cancel();
      this.createStore.reset();
    }
  }

  async saveAndOpenInPopup(): Promise<void> {
    const layer = this.createStore.layer();
    if (!(layer instanceof FeatureLayer)) return;

    try {
      const objectId = await this.createService.save();
      if (objectId == null) return;

      layer.refresh();

      const query = layer.createQuery();
      query.objectIds = [objectId];
      query.outFields = ['*'];
      query.returnGeometry = true;

      const featureSet = await layer.queryFeatures(query);
      const graphic = featureSet.features[0];
      if (graphic) {
        this.popupStore.open([graphic]);
      }
    } catch (error) {
      throw new SaveAndOpenPopupError(error);
    }
  }

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
      case 'string':
      case 'date':
        return rawValue;
    }
  }

  private convertCodedValue(rawValue: string, field: AttributeEditField): string | number | null {
    const numericValue = Number(rawValue);
    if (!Number.isNaN(numericValue)) {
      const match = field.codedValues.find((cv) => cv.code === numericValue);
      if (match) return numericValue;
    }
    const stringMatch = field.codedValues.find((cv) => String(cv.code) === rawValue);
    if (stringMatch) return stringMatch.code;
    return Number.isNaN(numericValue) ? rawValue : numericValue;
  }
}
