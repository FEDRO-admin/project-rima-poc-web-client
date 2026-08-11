import { Component, computed, CUSTOM_ELEMENTS_SCHEMA, effect, inject, input, signal, untracked } from '@angular/core';
import type Graphic from '@arcgis/core/Graphic';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import '@esri/calcite-components/dist/components/calcite-icon';
import { StatusComponentStore } from './status-component.store';
import { StatusComponentService } from './status-component.service';
import { StatusRecord } from './status-types';
import { AttributeFormComponent } from '../../shared/attribute-form/attribute-form.component';
import { AttributeValue } from '../../shared/attribute-value-conversion';
import { DialogActionsComponent } from '../../../shared/dialog-actions/dialog-actions.component';
import { DialogActionComponent } from '../../../shared/dialog-actions/dialog-action.component';
import { ViewStore } from '../../view/view.store';
import { ActionBarComponent } from '../../../shared/action-bar/action-bar.component';
import { ActionBarButtonComponent } from '../../../shared/action-bar/action-bar-button.component';

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
  protected readonly confirmingDeleteId = signal<number | undefined>(undefined);
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
        this.confirmingDeleteId.set(undefined);
        this.confirmAction.set(null);
        this.service.loadForGraphic(graphic);
      });
    });
  }

  protected isExpanded(objectId: number | undefined): boolean {
    if (objectId == null) return false;
    return this.store.expandedObjectIds().includes(objectId);
  }

  protected toggleExpand(record: StatusRecord): void {
    if (record.objectId != null) {
      this.store.toggleExpanded(record.objectId);
    }
  }

  protected startEdit(record: StatusRecord): void {
    this.confirmingDeleteId.set(undefined);
    this.store.startEdit(record);
  }

  protected onFieldChange(event: { fieldName: string; value: AttributeValue }): void {
    this.store.updateField(event.fieldName, event.value);
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
      if (this.store.creating()) {
        await this.saveCreate();
      } else {
        await this.saveEdit();
      }
    } else if (action === 'cancel') {
      if (this.store.creating()) {
        this.cancelCreate();
      } else {
        this.cancelEdit();
      }
    }
  }

  protected dismissConfirm(): void {
    this.confirmAction.set(null);
  }

  protected startCreate(): void {
    this.store.markCreating();
  }

  protected requestDelete(objectId: number): void {
    this.confirmingDeleteId.set(objectId);
  }

  protected async onDeleteConfirm(): Promise<void> {
    const objectId = this.confirmingDeleteId();
    this.confirmingDeleteId.set(undefined);
    if (objectId == null) return;
    await this.service.deleteRecord(this.graphic(), objectId);
  }

  protected cancelDeleteConfirm(): void {
    this.confirmingDeleteId.set(undefined);
  }

  private cancelEdit(): void {
    this.store.cancelEdit();
  }

  private cancelCreate(): void {
    this.store.cancelCreating();
  }

  private async saveEdit(): Promise<void> {
    await this.service.saveRecord(this.graphic());
  }

  private async saveCreate(): Promise<void> {
    const graphic = this.graphic();
    const layer = graphic.layer;
    if (!(layer instanceof FeatureLayer)) return;

    const parentId = typeof graphic.attributes.id === 'string' ? graphic.attributes.id : undefined;
    if (!parentId) return;

    await this.service.createRecord(graphic, parentId, layer.layerId);
  }
}
