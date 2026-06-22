import { Component, CUSTOM_ELEMENTS_SCHEMA, inject, signal, viewChild } from '@angular/core';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import { CreateStore } from '../create.store';
import { CreateService } from '../create.service';
import { CreateGeometryService } from '../create-geometry.service';
import { CreateEffects } from '../create-effects';
import { LayerPickerComponent } from '../layer-picker/layer-picker.component';
import { CreateFormComponent } from '../create-form/create-form.component';
import { ConfirmDialogComponent } from '../../../shared/confirm-dialog/confirm-dialog.component';
import { CreateLayerLoadError } from '../create-errors';
import '@esri/calcite-components/dist/components/calcite-icon';

@Component({
  selector: 'rima-create-panel',
  imports: [LayerPickerComponent, CreateFormComponent, ConfirmDialogComponent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './create-panel.component.html',
  styleUrl: './create-panel.component.scss',
})
export class CreatePanelComponent {
  protected readonly store = inject(CreateStore);
  private readonly createService = inject(CreateService);
  private readonly createGeometryService = inject(CreateGeometryService);
  protected readonly createEffects = inject(CreateEffects);

  protected readonly showCloseConfirm = signal(false);

  private readonly createFormRef = viewChild(CreateFormComponent);

  protected async onLayerSelected(layer: FeatureLayer): Promise<void> {
    this.createGeometryService.cancel();

    try {
      await layer.load();
    } catch (error) {
      throw new CreateLayerLoadError(error);
    }

    this.store.setLayer(layer);
    this.resolveAndStoreSubtype(layer);

    // Wait a tick for the form component to render, then initialize it
    queueMicrotask(() => {
      this.createFormRef()?.initializeForm();
    });
  }

  private resolveAndStoreSubtype(layer: FeatureLayer): void {
    const subtypeField = layer.typeIdField || (layer.sourceJSON?.['subtypeField'] as string | undefined);
    if (!subtypeField) return;

    const template = layer.templates?.[0];
    const templateValue = template?.prototype?.attributes?.[subtypeField] as number | string | undefined;
    if (templateValue != null) {
      this.store.setSubtype(subtypeField, templateValue);
    }
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
