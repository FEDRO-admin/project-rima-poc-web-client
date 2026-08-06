import { Component, computed, CUSTOM_ELEMENTS_SCHEMA, inject, OnDestroy, signal } from '@angular/core';
import type { CreateTool } from '@arcgis/core/widgets/Sketch/types';
import { CreateStore } from '../create.store';
import { CreateGeometryService } from '../create-geometry.service';
import { AttributeEditField } from '../../shared/attribute-edit-field';
import { AttributeValue } from '../../shared/attribute-value-conversion';
import { resolveCreatableFields } from '../create-attribute.service';
import { DrawingToolOption, getDrawingToolsForGeometryType } from '../create-config';
import { DialogActionsComponent } from '../../../shared/dialog-actions/dialog-actions.component';
import { DialogActionComponent } from '../../../shared/dialog-actions/dialog-action.component';
import '@esri/calcite-components/dist/components/calcite-icon';
import { CreateService } from '../create.service';
import { AttributeFormComponent } from '../../shared/attribute-form/attribute-form.component';
import { ViewStore } from '../../view/view.store';

type ConfirmAction = 'save' | 'cancel' | 'close' | null;

@Component({
  selector: 'rima-create-form',
  imports: [DialogActionsComponent, DialogActionComponent, AttributeFormComponent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './create-form.component.html',
  styleUrl: './create-form.component.scss',
})
export class CreateFormComponent implements OnDestroy {
  protected readonly createStore = inject(CreateStore);
  protected readonly viewStore = inject(ViewStore);
  private readonly createGeometryService = inject(CreateGeometryService);
  private readonly createService = inject(CreateService);

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

  protected readonly confirmMessage = computed(() => {
    const action = this.confirmAction();
    if (action === 'save') return 'Are you sure you want to create this feature?';
    if (action === 'cancel' || action === 'close')
      return 'You have unsaved changes. Are you sure you want to discard them?';
    return undefined;
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

  protected async onConfirmPrimary(): Promise<void> {
    const action = this.confirmAction();
    this.confirmAction.set(null);

    if (action === 'save') {
      await this.createService.saveAndOpenInPopup();
    } else if (action === 'cancel' || action === 'close') {
      this.close();
    }
  }

  protected dismissConfirm(): void {
    this.confirmAction.set(null);
  }

  private close(): void {
    this.createService.cancel();
  }
}
