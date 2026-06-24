import { Component, computed, CUSTOM_ELEMENTS_SCHEMA, DestroyRef, inject, input, signal } from '@angular/core';
import Graphic from '@arcgis/core/Graphic';
import { AttributeEditStore } from '../attribute-edit.store';
import { AttributeEditService } from '../attribute-edit.service';
import { AttributeEditField } from '../../../shared/attribute-edit-field';
import { AttributeValue } from '../../../shared/attribute-value-conversion';
import { ConfirmDialogComponent } from '../../../../shared/confirm-dialog/confirm-dialog.component';
import '@esri/calcite-components/dist/components/calcite-icon';
import { resolveEditableAttributeFields } from '../../../layer/layer-attribute-domain-resolver';
import { AttributeFormComponent } from '../../../shared/attribute-form/attribute-form.component';

type ConfirmAction = 'save' | 'cancel' | null;

@Component({
  selector: 'rima-edit-form',
  imports: [ConfirmDialogComponent, AttributeFormComponent],
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

  protected onAttributeFieldChange(event: { fieldName: string; value: AttributeValue }): void {
    this.attributeEditStore.updateField(event.fieldName, event.value);
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
}
