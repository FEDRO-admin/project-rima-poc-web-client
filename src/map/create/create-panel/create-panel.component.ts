import { Component, CUSTOM_ELEMENTS_SCHEMA, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { CreateStore } from '../create.store';
import { CreateGeometryService } from '../create-geometry.service';
import { CreateEffects } from '../create-effects';
import { CreateFormComponent } from '../create-form/create-form.component';
import { ConfirmDialogComponent } from '../../../shared/confirm-dialog/confirm-dialog.component';
import '@esri/calcite-components/dist/components/calcite-icon';

@Component({
  selector: 'rima-create-panel',
  imports: [CreateFormComponent, ConfirmDialogComponent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './create-panel.component.html',
  styleUrl: './create-panel.component.scss',
})
export class CreatePanelComponent {
  protected readonly store = inject(CreateStore);
  private readonly createGeometryService = inject(CreateGeometryService);
  protected readonly createEffects = inject(CreateEffects);

  protected readonly showCloseConfirm = signal(false);

  private readonly createFormRef = viewChild(CreateFormComponent);

  constructor() {
    effect(() => {
      const layer = this.store.layer();
      const formRef = this.createFormRef();
      untracked(() => {
        if (layer && formRef) {
          queueMicrotask(() => formRef.initializeForm());
        }
      });
    });
  }

  protected requestClose(): void {
    if (this.store.isDirty()) {
      this.showCloseConfirm.set(true);
    } else {
      this.close();
    }
  }

  protected onCloseConfirm(confirmed: boolean): void {
    this.showCloseConfirm.set(false);
    if (confirmed) {
      this.close();
    }
  }

  protected onEscape(): void {
    this.requestClose();
  }

  private close(): void {
    this.createGeometryService.cancel();
    this.store.reset();
  }
}
