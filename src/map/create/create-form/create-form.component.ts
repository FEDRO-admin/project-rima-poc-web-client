import {
  Component,
  computed,
  CUSTOM_ELEMENTS_SCHEMA,
  effect,
  inject,
  OnDestroy,
  signal,
  untracked,
} from '@angular/core';
import type { CreateTool } from '@arcgis/core/widgets/Sketch/types';
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
import { ReferencePointListComponent } from '../../shared/reference-point/reference-point-list/reference-point-list.component';
import { ReferencePointStore } from '../../shared/reference-point/reference-point.store';
import { ReferencePointService } from '../../shared/reference-point/reference-point.service';

type ConfirmAction = 'save' | 'cancel' | 'close' | null;

@Component({
  selector: 'rima-create-form',
  imports: [ConfirmDialogComponent, AttributeFormComponent, ReferencePointListComponent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './create-form.component.html',
  styleUrl: './create-form.component.scss',
})
export class CreateFormComponent implements OnDestroy {
  protected readonly createStore = inject(CreateStore);
  private readonly createGeometryService = inject(CreateGeometryService);
  private readonly createService = inject(CreateService);
  protected readonly refPointStore = inject(ReferencePointStore);
  private readonly referencePointService = inject(ReferencePointService);

  protected readonly confirmAction = signal<ConfirmAction>(null);

  protected readonly activeTool = signal<CreateTool | undefined>(undefined);

  constructor() {
    effect(() => {
      const layer = this.createStore.layer();
      untracked(() => {
        if (layer) {
          this.referencePointService.initializeForCreate(layer);
        }
      });
    });
  }

  ngOnDestroy(): void {
    this.createGeometryService.cancel();
  }

  protected readonly layer = computed(() => this.createStore.layer());

  protected readonly fields = computed<AttributeEditField[]>(() => {
    const layer = this.createStore.layer();
    const subtype = this.createStore.subtypeValue();
    if (!layer) return [];
    return resolveCreatableFields(layer, subtype);
  });

  protected readonly drawingTools = computed<DrawingToolOption[]>(() => {
    const layer = this.createStore.layer();
    if (!layer) return [];
    return getDrawingToolsForGeometryType(layer.geometryType);
  });

  protected readonly canSave = computed<boolean>(() => {
    const hasGeometry = this.createStore.geometry() != null;
    const notSaving = !this.createStore.saving();
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
      await this.createService.saveAndOpenInPopup();
    } else if (action === 'cancel' || action === 'close') {
      this.close();
    }
  }

  private close(): void {
    this.createGeometryService.cancel();
    this.createStore.reset();
  }
}
