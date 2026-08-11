import { Component, computed, CUSTOM_ELEMENTS_SCHEMA, effect, inject, input, signal, untracked } from '@angular/core';
import type Graphic from '@arcgis/core/Graphic';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import '@esri/calcite-components/dist/components/calcite-icon';
import { StatusComponentStore } from './status-component.store';
import { StatusComponentService } from './status-component.service';
import { AttributeFormComponent } from '../../../shared/attribute-form/attribute-form.component';
import { AttributeValue } from '../../../shared/attribute-value-conversion';
import { DialogActionsComponent } from '../../../../shared/dialog-actions/dialog-actions.component';
import { DialogActionComponent } from '../../../../shared/dialog-actions/dialog-action.component';
import { ViewStore } from '../../../view/view.store';
import { ActionBarComponent } from '../../../../shared/action-bar/action-bar.component';
import { ActionBarButtonComponent } from '../../../../shared/action-bar/action-bar-button.component';

type StatusMode = 'view' | 'edit';
type StatusConfirmAction = 'save' | 'cancel' | null;

@Component({
  selector: 'rima-status',
  imports: [
    AttributeFormComponent,
    DialogActionsComponent,
    DialogActionComponent,
    ActionBarComponent,
    ActionBarButtonComponent,
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  providers: [StatusComponentStore, StatusComponentService],
  templateUrl: './status.component.html',
  styleUrl: './status.component.scss',
})
export class StatusComponent {
  readonly graphic = input.required<Graphic>();

  protected readonly store = inject(StatusComponentStore);
  protected readonly service = inject(StatusComponentService);
  protected readonly viewStore = inject(ViewStore);
  protected readonly confirmingDelete = signal(false);
  protected readonly mode = signal<StatusMode>('view');
  protected readonly confirmAction = signal<StatusConfirmAction>(null);

  protected readonly confirmMessage = computed(() => {
    const action = this.confirmAction();
    if (action === 'save') return 'Are you sure you want to save the status changes?';
    if (action === 'cancel') return 'You have unsaved changes. Are you sure you want to discard them?';
    return undefined;
  });

  constructor() {
    this.loadOnGraphicChange();
  }

  private loadOnGraphicChange(): void {
    effect(() => {
      const graphic = this.graphic();
      untracked(() => {
        this.mode.set('view');
        this.service.loadForGraphic(graphic);
      });
    });
  }

  protected onFieldChange(event: { fieldName: string; value: AttributeValue }): void {
    this.store.updateField(event.fieldName, event.value);
  }

  protected startEdit(): void {
    this.confirmingDelete.set(false);
    this.mode.set('edit');
  }

  protected createStatus(): void {
    this.store.markCreating();
  }

  protected requestSave(): void {
    this.confirmAction.set('save');
  }

  protected requestCancel(): void {
    if (this.store.hasPendingChanges()) {
      this.confirmAction.set('cancel');
    } else {
      this.cancelEdit();
    }
  }

  protected requestCancelCreate(): void {
    if (this.store.hasPendingChanges()) {
      this.confirmAction.set('cancel');
    } else {
      this.cancelCreate();
    }
  }

  protected async onConfirmPrimary(): Promise<void> {
    const action = this.confirmAction();
    this.confirmAction.set(null);

    if (action === 'save') {
      await this.save();
    } else if (action === 'cancel') {
      if (this.store.showCreateForm()) {
        this.cancelCreate();
      } else {
        this.cancelEdit();
      }
    }
  }

  protected dismissConfirm(): void {
    this.confirmAction.set(null);
  }

  private cancelEdit(): void {
    this.store.cancelEdit();
    this.mode.set('view');
  }

  private cancelCreate(): void {
    this.store.cancelCreating();
  }

  protected requestDelete(): void {
    this.confirmingDelete.set(true);
  }

  protected onDeleteConfirm(): void {
    this.confirmingDelete.set(false);
    this.store.markDeleted();
  }

  protected cancelDeleteConfirm(): void {
    this.confirmingDelete.set(false);
  }

  protected async save(): Promise<void> {
    const graphic = this.graphic();
    const layer = graphic.layer;
    if (!(layer instanceof FeatureLayer)) return;

    const parentId = typeof graphic.attributes.id === 'string' ? graphic.attributes.id : undefined;
    await this.service.save(graphic, parentId, layer.layerId);
    this.mode.set('view');
  }
}
