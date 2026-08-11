import { Component, computed, CUSTOM_ELEMENTS_SCHEMA, inject, input, signal } from '@angular/core';
import Graphic from '@arcgis/core/Graphic';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import '@esri/calcite-components/dist/components/calcite-icon';
import { isImmutableField } from '../../../layer/layer-attributes';
import {
  resolveFieldDisplayValue,
  resolveEditableAttributeFields,
} from '../../../layer/layer-attribute-domain-resolver';
import { isLayerEditable, isLayerDeletable } from '../../../layer/layer-capabilities';
import { ViewStore } from '../../../view/view.store';
import { ViewService } from '../../../view/view.service';
import { EditStore } from '../../../edit/edit.store';
import { EditService } from '../../../edit/edit.service';
import { DeleteService } from '../../../delete/delete.service';
import { ActionBarComponent } from '../../../../shared/action-bar/action-bar.component';
import { ActionBarButtonComponent } from '../../../../shared/action-bar/action-bar-button.component';
import { AttributeFormComponent } from '../../../shared/attribute-form/attribute-form.component';
import { DialogActionsComponent } from '../../../../shared/dialog-actions/dialog-actions.component';
import { DialogActionComponent } from '../../../../shared/dialog-actions/dialog-action.component';
import type { AttributeEditField } from '../../../shared/attribute-edit-field';
import type { AttributeValue } from '../../../shared/attribute-value-conversion';

type ConfirmAction = 'save' | 'cancel' | null;

interface FieldEntry {
  label: string;
  value: string | number | boolean | null;
}

@Component({
  selector: 'rima-attributes-tab',
  imports: [
    ActionBarComponent,
    ActionBarButtonComponent,
    AttributeFormComponent,
    DialogActionsComponent,
    DialogActionComponent,
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './attributes-tab.component.html',
  styleUrl: './attributes-tab.component.scss',
})
export class AttributesTabComponent {
  readonly graphic = input.required<Graphic>();

  protected readonly viewStore = inject(ViewStore);
  protected readonly editStore = inject(EditStore);
  private readonly viewService = inject(ViewService);
  private readonly editService = inject(EditService);
  private readonly deleteService = inject(DeleteService);

  protected readonly confirmAction = signal<ConfirmAction>(null);

  protected readonly isEditable = computed(() => {
    if (this.viewStore.locked() || this.viewStore.historic()) return false;
    return isLayerEditable(this.graphic());
  });

  protected readonly isDeletable = computed(() => {
    if (this.viewStore.locked() || this.viewStore.historic()) return false;
    return isLayerDeletable(this.graphic());
  });

  protected readonly fields = computed<FieldEntry[]>(() => {
    const graphic: Graphic = this.graphic();
    const layer = graphic.layer;
    const attrs: Record<string, string | number | boolean | null> = graphic.attributes ?? {};

    if (layer instanceof FeatureLayer && layer.fields?.length) {
      return layer.fields
        .filter((field) => !isImmutableField(field.name, layer))
        .map((field) => ({
          label: field.alias || field.name,
          value: resolveFieldDisplayValue(graphic, field, attrs[field.name]),
        }));
    }

    return Object.entries(attrs).map(([key, value]) => ({ label: key, value }));
  });

  protected readonly immutableFields = computed<FieldEntry[]>(() => {
    const graphic: Graphic = this.graphic();
    const layer = graphic.layer;
    const attrs: Record<string, string | number | boolean | null> = graphic.attributes ?? {};

    if (layer instanceof FeatureLayer && layer.fields?.length) {
      return layer.fields
        .filter((field) => isImmutableField(field.name, layer))
        .map((field) => ({
          label: field.alias || field.name,
          value: resolveFieldDisplayValue(graphic, field, attrs[field.name]),
        }));
    }

    return [];
  });

  protected readonly editableFields = computed<AttributeEditField[]>(() => {
    const graphic = this.editStore.graphic();
    if (!graphic) return [];
    return resolveEditableAttributeFields(graphic);
  });

  protected readonly supportsGeometryUpdate = computed(() => {
    const graphic = this.editStore.graphic();
    if (!graphic) return false;
    const layer = graphic.layer;
    if (!(layer instanceof FeatureLayer)) return false;
    return (layer.capabilities?.editing?.supportsGeometryUpdate ?? false) && graphic.geometry != null;
  });

  protected readonly canSave = computed(() => {
    return this.editStore.isDirty() && !this.viewStore.saving();
  });

  protected readonly confirmMessage = computed(() => {
    const action = this.confirmAction();
    if (action === 'save') return 'Are you sure you want to save the changes to this feature?';
    if (action === 'cancel') return 'You have unsaved changes. Are you sure you want to discard them?';
    return undefined;
  });

  protected zoomTo(): void {
    const graphic = this.graphic();
    const view = this.viewService.activeView();
    if (!graphic.geometry || !view) return;
    view.goTo({ target: graphic.geometry, zoom: 15 });
  }

  protected startEdit(): void {
    this.editService.activate(this.graphic());
  }

  protected startDelete(): void {
    this.deleteService.requestDelete(this.graphic());
  }

  protected onFieldChange(event: { fieldName: string; value: AttributeValue }): void {
    this.editStore.updateField(event.fieldName, event.value);
  }

  protected startGeometryEditing(): void {
    this.editService.startGeometryEditing();
  }

  protected confirmGeometry(): void {
    this.editService.confirmGeometry();
  }

  protected discardGeometry(): void {
    this.editService.discardGeometry();
  }

  protected reenterSketch(): void {
    this.editService.reenterSketch();
  }

  protected undo(): void {
    this.editService.undo();
  }

  protected redo(): void {
    this.editService.redo();
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

  protected async onConfirmPrimary(): Promise<void> {
    const action = this.confirmAction();
    this.confirmAction.set(null);

    if (action === 'save') {
      await this.editService.save();
    } else if (action === 'cancel') {
      this.editService.cancel();
    }
  }

  protected dismissConfirm(): void {
    this.confirmAction.set(null);
  }
}
