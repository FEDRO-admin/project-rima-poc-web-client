import { Component, computed, CUSTOM_ELEMENTS_SCHEMA, inject, OnDestroy, signal } from '@angular/core';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import { EditStore } from '../edit.store';
import { EditService } from '../edit.service';
import { AttributeEditField } from '../../shared/attribute-edit-field';
import { AttributeValue } from '../../shared/attribute-value-conversion';
import { ConfirmDialogComponent } from '../../../shared/confirm-dialog/confirm-dialog.component';
import '@esri/calcite-components/dist/components/calcite-icon';
import { resolveEditableAttributeFields } from '../../layer/layer-attribute-domain-resolver';
import { AttributeFormComponent } from '../../shared/attribute-form/attribute-form.component';
import { ReferencePointListComponent } from '../../shared/reference-point/reference-point-list/reference-point-list.component';
import { ReferencePointStore } from '../../shared/reference-point/reference-point.store';

type ConfirmAction = 'save' | 'cancel' | 'close' | null;

@Component({
  selector: 'rima-edit-form',
  imports: [ConfirmDialogComponent, AttributeFormComponent, ReferencePointListComponent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './edit-form.component.html',
  styleUrl: './edit-form.component.scss',
})
export class EditFormComponent implements OnDestroy {
  protected readonly store = inject(EditStore);
  private readonly editService = inject(EditService);
  protected readonly refPointStore = inject(ReferencePointStore);

  protected readonly confirmAction = signal<ConfirmAction>(null);

  ngOnDestroy(): void {
    this.editService.reset();
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

  protected readonly refPointSketchActive = computed(() => this.refPointStore.sketchActive());

  protected readonly canSave = computed(() => {
    const dirty = this.store.isDirty() || this.refPointStore.hasPendingChanges();
    return dirty && !this.store.saving();
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

  protected async onConfirm(confirmed: boolean): Promise<void> {
    const action = this.confirmAction();
    this.confirmAction.set(null);

    if (!confirmed) return;

    if (action === 'save') {
      await this.editService.save();
    } else if (action === 'cancel' || action === 'close') {
      this.editService.cancel();
    }
  }
}
