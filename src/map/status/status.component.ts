import { Component, CUSTOM_ELEMENTS_SCHEMA, effect, inject, input, signal, untracked } from '@angular/core';
import type Graphic from '@arcgis/core/Graphic';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import '@esri/calcite-components/dist/components/calcite-icon';
import { StatusComponentStore } from './status-component.store';
import { StatusComponentService } from './status-component.service';
import { AttributeFormComponent } from '../shared/attribute-form/attribute-form.component';
import { AttributeValue } from '../shared/attribute-value-conversion';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog/confirm-dialog.component';
import { ViewStore } from '../view/view.store';

type StatusMode = 'view' | 'edit';

@Component({
  selector: 'rima-status',
  imports: [AttributeFormComponent, ConfirmDialogComponent],
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
    this.mode.set('edit');
  }

  protected cancelEdit(): void {
    this.store.cancelEdit();
    this.mode.set('view');
  }

  protected createStatus(): void {
    this.store.markCreating();
  }

  protected cancelCreate(): void {
    this.store.cancelCreating();
  }

  protected requestDelete(): void {
    this.confirmingDelete.set(true);
  }

  protected onDeleteConfirm(confirmed: boolean): void {
    this.confirmingDelete.set(false);
    if (confirmed) {
      this.store.markDeleted();
    }
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
