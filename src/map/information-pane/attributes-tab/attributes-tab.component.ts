import { Component, computed, CUSTOM_ELEMENTS_SCHEMA, inject, input, signal } from '@angular/core';
import Graphic from '@arcgis/core/Graphic';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import type { CreateTool } from '@arcgis/core/widgets/Sketch/types';
import '@esri/calcite-components/dist/components/calcite-icon';
import { hasFieldMetadata, isImmutableField } from '../../layer/layer-attributes';
import { resolveFieldDisplayValue, resolveEditableAttributeFields } from '../../layer/layer-attribute-domain-resolver';
import { isLayerEditable, isLayerDeletable } from '../../layer/layer-capabilities';
import { RBBS_FIELDS } from '../../rbbs/rbbs-config';
import { ViewStore } from '../../view/view.store';
import { ViewService } from '../../view/view.service';
import { AttributeEditStore } from './attribute-edit.store';
import { AttributeEditService } from './attribute-edit.service';
import { AttributeDeleteService } from './attribute-delete.service';
import { resolveCreatableFields } from './attribute-field-utils';
import { type DrawingToolOption, getDrawingToolsForGeometryType } from './attributes-config';
import { ActionBarComponent } from '../../../shared/action-bar/action-bar.component';
import { ActionBarButtonComponent } from '../../../shared/action-bar/action-bar-button.component';
import { AttributeFormComponent } from '../../shared/attribute-form/attribute-form.component';
import { DialogActionsComponent } from '../../../shared/dialog-actions/dialog-actions.component';
import { DialogActionComponent } from '../../../shared/dialog-actions/dialog-action.component';
import type { AttributeEditField } from '../../shared/attribute-edit-field';
import type { AttributeValue } from '../../shared/attribute-value-conversion';

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
  readonly graphic = input<Graphic>();

  protected readonly viewStore = inject(ViewStore);
  protected readonly editStore = inject(AttributeEditStore);
  private readonly viewService = inject(ViewService);
  private readonly editService = inject(AttributeEditService);
  private readonly deleteService = inject(AttributeDeleteService);

  protected readonly confirmAction = signal<ConfirmAction>(null);
  protected readonly activeTool = signal<CreateTool | undefined>(undefined);

  protected readonly isEditable = computed(() => {
    const graphic = this.graphic();
    if (!graphic || this.viewStore.locked() || this.viewStore.historic()) return false;
    return isLayerEditable(graphic);
  });

  protected readonly isDeletable = computed(() => {
    const graphic = this.graphic();
    if (!graphic || this.viewStore.locked() || this.viewStore.historic()) return false;
    return isLayerDeletable(graphic);
  });

  protected readonly fields = computed<FieldEntry[]>(() => {
    const graphic = this.graphic();
    if (!graphic) return [];
    const layer = graphic.layer;
    const attrs: Record<string, string | number | boolean | null> = graphic.attributes ?? {};

    if (hasFieldMetadata(layer)) {
      return layer.fields
        .filter((field) => !isImmutableField(field.name, layer) && !RBBS_FIELDS.includes(field.name))
        .map((field) => ({
          label: field.alias || field.name,
          value: resolveFieldDisplayValue(graphic, field, attrs[field.name]),
        }));
    }

    return Object.entries(attrs).map(([key, value]) => ({ label: key, value }));
  });

  protected readonly rbbsFields = computed<FieldEntry[]>(() => {
    const graphic = this.graphic();
    if (!graphic) return [];
    const layer = graphic.layer;
    const attrs: Record<string, string | number | boolean | null> = graphic.attributes ?? {};

    if (hasFieldMetadata(layer)) {
      return layer.fields
        .filter((field) => RBBS_FIELDS.includes(field.name))
        .map((field) => ({
          label: field.alias || field.name,
          value: resolveFieldDisplayValue(graphic, field, attrs[field.name]),
        }));
    }

    return [];
  });

  protected readonly immutableFields = computed<FieldEntry[]>(() => {
    const graphic = this.graphic();
    if (!graphic) return [];
    const layer = graphic.layer;
    const attrs: Record<string, string | number | boolean | null> = graphic.attributes ?? {};

    if (hasFieldMetadata(layer)) {
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
    if (this.editStore.isEditing()) {
      const graphic = this.editStore.graphic();
      if (!graphic) return [];
      return resolveEditableAttributeFields(graphic);
    }
    if (this.editStore.isCreating()) {
      const layer = this.editStore.layer();
      if (!layer) return [];
      return resolveCreatableFields(layer);
    }
    return [];
  });

  protected readonly supportsGeometryUpdate = computed(() => {
    if (this.editStore.isCreating()) return false;
    const graphic = this.editStore.graphic();
    if (!graphic) return false;
    const layer = graphic.layer;
    if (!(layer instanceof FeatureLayer)) return false;
    return (layer.capabilities?.editing?.supportsGeometryUpdate ?? false) && graphic.geometry != null;
  });

  protected readonly drawingTools = computed<DrawingToolOption[]>(() => {
    const layer = this.editStore.layer();
    if (!layer) return [];
    return getDrawingToolsForGeometryType(layer.geometryType);
  });

  protected readonly canSave = computed(() => {
    if (this.editStore.isCreating()) {
      return this.editStore.editedGeometry() != null && !this.viewStore.saving();
    }
    return this.editStore.isDirty() && !this.viewStore.saving();
  });

  protected readonly confirmMessage = computed(() => {
    const action = this.confirmAction();
    if (action === 'save') {
      return this.editStore.isCreating()
        ? 'Are you sure you want to create this feature?'
        : 'Are you sure you want to save the changes to this feature?';
    }
    if (action === 'cancel') return 'You have unsaved changes. Are you sure you want to discard them?';
    return undefined;
  });

  protected zoomTo(): void {
    const graphic = this.graphic();
    const view = this.viewService.activeView();
    if (!graphic?.geometry || !view) return;
    view.goTo({ target: graphic.geometry, zoom: 15 });
  }

  protected startEdit(): void {
    const graphic = this.graphic();
    if (graphic) this.editService.activateEdit(graphic);
  }

  protected startDelete(): void {
    const graphic = this.graphic();
    if (graphic) this.deleteService.requestDelete(graphic);
  }

  protected onFieldChange(event: { fieldName: string; value: AttributeValue }): void {
    this.editStore.updateField(event.fieldName, event.value);
  }

  // ── Edit geometry delegates ──

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

  // ── Create geometry delegates ──

  protected selectTool(tool: CreateTool): void {
    this.activeTool.set(tool);
    const layer = this.editStore.layer();
    if (layer) this.editService.startDrawing(layer, tool);
  }

  protected clearCreateGeometry(): void {
    this.editService.clearGeometry();
    this.activeTool.set(undefined);
  }

  protected confirmPlacement(): void {
    this.editService.confirmPlacement();
  }

  protected editCreateGeometry(): void {
    this.editService.reenterAdjusting();
  }

  // ── Shared ──

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
