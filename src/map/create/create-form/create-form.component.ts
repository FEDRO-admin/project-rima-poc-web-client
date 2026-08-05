import { Component, computed, CUSTOM_ELEMENTS_SCHEMA, inject, OnDestroy, signal, viewChild } from '@angular/core';
import type { CreateTool } from '@arcgis/core/widgets/Sketch/types';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import { CreateStore } from '../create.store';
import { CreateGeometryService } from '../create-geometry.service';
import { AttributeEditField } from '../../shared/attribute-edit-field';
import { AttributeValue } from '../../shared/attribute-value-conversion';
import { resolveCreatableFields } from '../create-attribute.service';
import { DrawingToolOption, getDrawingToolsForGeometryType } from '../create-config';
import { ConfirmDialogComponent } from '../../../shared/confirm-dialog/confirm-dialog.component';
import '@esri/calcite-components/dist/components/calcite-icon';
import { CreateService } from '../create.service';
import { AttributeFormComponent } from '../../shared/attribute-form/attribute-form.component';
import { ReferencePointComponent } from '../../reference/reference-point/reference-point.component';
import { ViewStore } from '../../view/view.store';
import { PopupStore } from '../../popup/popup.store';

type ConfirmAction = 'save' | 'cancel' | 'close' | null;

@Component({
  selector: 'rima-create-form',
  imports: [ConfirmDialogComponent, AttributeFormComponent, ReferencePointComponent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './create-form.component.html',
  styleUrl: './create-form.component.scss',
})
export class CreateFormComponent implements OnDestroy {
  protected readonly createStore = inject(CreateStore);
  protected readonly viewStore = inject(ViewStore);
  private readonly createGeometryService = inject(CreateGeometryService);
  private readonly createService = inject(CreateService);
  private readonly popupStore = inject(PopupStore);

  private readonly vonRef = viewChild<ReferencePointComponent>('vonRef');
  private readonly bisRef = viewChild<ReferencePointComponent>('bisRef');

  protected readonly confirmAction = signal<ConfirmAction>(null);
  protected readonly activeTool = signal<CreateTool | undefined>(undefined);

  ngOnDestroy(): void {
    this.createGeometryService.cancel();
  }

  protected readonly layer = computed(() => this.createStore.layer());

  protected readonly fields = computed<AttributeEditField[]>(() => {
    const layer = this.createStore.layer();
    if (!layer) return [];
    return resolveCreatableFields(layer);
  });

  protected readonly drawingTools = computed<DrawingToolOption[]>(() => {
    const layer = this.createStore.layer();
    if (!layer) return [];
    return getDrawingToolsForGeometryType(layer.geometryType);
  });

  protected readonly canSave = computed<boolean>(() => {
    const hasGeometry = this.createStore.geometry() != null;
    const notSaving = !this.viewStore.saving();
    return hasGeometry && notSaving;
  });

  protected onAttributeFieldChange(event: { fieldName: string; value: AttributeValue }): void {
    this.createStore.updateField(event.fieldName, event.value);
  }

  protected selectTool(tool: CreateTool): void {
    this.activeTool.set(tool);
    const layer = this.createStore.layer();
    if (layer) {
      this.createGeometryService.startDrawing(layer, tool);
    }
  }

  protected clearGeometry(): void {
    this.createGeometryService.cancel();
    this.createStore.updateGeometry(undefined!);
    this.activeTool.set(undefined);
  }

  protected confirmPlacement(): void {
    this.createGeometryService.confirmPlacement();
  }

  protected editGeometry(): void {
    this.createGeometryService.reenterAdjusting();
  }

  protected undo(): void {
    this.createGeometryService.undo();
  }

  protected redo(): void {
    this.createGeometryService.redo();
  }

  protected requestSave(): void {
    this.confirmAction.set('save');
  }

  protected requestCancel(): void {
    if (this.createStore.isDirty()) {
      this.confirmAction.set('cancel');
    } else {
      this.close();
    }
  }

  protected requestClose(): void {
    if (this.createStore.isDirty()) {
      this.confirmAction.set('close');
    } else {
      this.close();
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
      await this.performSave();
    } else if (action === 'cancel' || action === 'close') {
      this.close();
    }
  }

  private async performSave(): Promise<void> {
    const result = await this.createService.saveFeature();
    if (!result) return;

    try {
      result.layer.refresh();

      const query = result.layer.createQuery();
      query.objectIds = [result.objectId];
      query.outFields = ['*'];
      query.returnGeometry = true;

      const featureSet = await result.layer.queryFeatures(query);
      const graphic = featureSet.features[0];

      if (graphic) {
        const parentId = graphic.attributes.id;
        if (parentId) {
          await this.vonRef()?.save(parentId, result.layer.layerId);
          await this.bisRef()?.save(parentId, result.layer.layerId);
        }
        this.createService.finalize();
        this.popupStore.open([graphic]);
      } else {
        this.createService.finalize();
      }
    } catch {
      this.createService.finalize();
    }
  }

  private close(): void {
    this.createService.cancel();
  }
}
