import { Component, CUSTOM_ELEMENTS_SCHEMA, inject, input, signal } from '@angular/core';
import '@esri/calcite-components/dist/components/calcite-icon';
import { StatusStore } from '../status.store';
import { StatusService } from '../status.service';
import { AttributeFormComponent } from '../../shared/attribute-form/attribute-form.component';
import { AttributeValue } from '../../shared/attribute-value-conversion';
import { ConfirmDialogComponent } from '../../../shared/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'rima-status-edit',
  imports: [AttributeFormComponent, ConfirmDialogComponent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './status-edit.component.html',
  styleUrl: './status-edit.component.scss',
})
export class StatusEditComponent {
  readonly disabled = input<boolean>(false);

  protected readonly store = inject(StatusStore);
  protected readonly service = inject(StatusService);
  protected readonly confirmingDelete = signal(false);

  protected onFieldChange(event: { fieldName: string; value: AttributeValue }): void {
    this.store.updateField(event.fieldName, event.value);
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
}
