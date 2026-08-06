import { Component, computed, CUSTOM_ELEMENTS_SCHEMA, inject, OnDestroy, signal } from '@angular/core';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import { EditStore } from '../edit.store';
import { EditService } from '../edit.service';
import { ViewStore } from '../../view/view.store';
import { AttributeEditField } from '../../shared/attribute-edit-field';
import { AttributeValue } from '../../shared/attribute-value-conversion';
import { DialogActionsComponent } from '../../../shared/dialog-actions/dialog-actions.component';
import { DialogActionComponent } from '../../../shared/dialog-actions/dialog-action.component';
import '@esri/calcite-components/dist/components/calcite-icon';
import { resolveEditableAttributeFields } from '../../layer/layer-attribute-domain-resolver';
import { AttributeFormComponent } from '../../shared/attribute-form/attribute-form.component';

type ConfirmAction = 'save' | 'cancel' | 'close' | null;

@Component({
  selector: 'rima-edit-form',
  imports: [DialogActionsComponent, DialogActionComponent, AttributeFormComponent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './edit-form.component.html',
  styleUrl: './edit-form.component.scss',
})
export class EditFormComponent implements OnDestroy {
  protected readonly store = inject(EditStore);
  protected readonly viewStore = inject(ViewStore);
  private readonly editService = inject(EditService);

  protected readonly confirmAction = signal<ConfirmAction>(null);

  ngOnDestroy(): void {
    this.store.reset();
  }

  protected readonly fields = computed<AttributeEditField[]>(() => {
    const graphic = this.store.graphic();
    if (!graphic) return [];
    return resolveEditableAttributeFields(graphic);
  });

  protected readonly supportsGeometryUpdate = computed(() => {
    const graphic = this.store.graphic();
    if (!graphic) return false;
    const layer = graphic.layer;
    if (!(layer instanceof FeatureLayer)) return false;
    return layer.capabilities?.editing?.supportsGeometryUpdate ?? false;
  });

  protected readonly hasGeometry = computed(() => {
    const graphic = this.store.graphic();
    return graphic?.geometry != null;
  });

  protected readonly canSave = computed(() => {
    return this.store.isDirty() && !this.viewStore.saving();
  });

  protected readonly confirmMessage = computed(() => {
    const action = this.confirmAction();
    if (action === 'save') return 'Are you sure you want to save the changes to this feature?';
    if (action === 'cancel' || action === 'close')
      return 'You have unsaved changes. Are you sure you want to discard them?';
    return undefined;
  });

  protected onAttributeFieldChange(event: { fieldName: string; value: AttributeValue }): void {
    this.store.updateField(event.fieldName, event.value);
  }

  protected startGeometryEditing(): void {
    this.editService.startGeometryEditing();
  }

  protected reenterSketch(): void {
    this.editService.reenterSketch();
  }

  protected confirmGeometry(): void {
    this.editService.confirmGeometry();
  }

  protected discardGeometry(): void {
    this.editService.discardGeometry();
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
    if (this.store.isDirty()) {
      this.confirmAction.set('cancel');
    } else {
      this.editService.cancel();
    }
  }

  protected requestClose(): void {
    if (this.store.isDirty()) {
      this.confirmAction.set('close');
    } else {
      this.editService.cancel();
    }
  }

  protected onEscape(): void {
    this.requestClose();
  }

  protected async onConfirmPrimary(): Promise<void> {
    const action = this.confirmAction();
    this.confirmAction.set(null);

    if (action === 'save') {
      await this.editService.save();
    } else if (action === 'cancel' || action === 'close') {
      this.editService.cancel();
    }
  }

  protected dismissConfirm(): void {
    this.confirmAction.set(null);
  }
}
