import {
  Component,
  computed,
  CUSTOM_ELEMENTS_SCHEMA,
  effect,
  inject,
  input,
  OnDestroy,
  signal,
  untracked,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import type Graphic from '@arcgis/core/Graphic';
import type Point from '@arcgis/core/geometry/Point';
import type FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import FeatureLayerClass from '@arcgis/core/layers/FeatureLayer';
import '@esri/calcite-components/dist/components/calcite-icon';
import { StatusComponentStore } from './status-component.store';
import { StatusComponentService } from './status-component.service';
import { STATUS_POINT_PLACING_SYMBOL } from './status-geometry-config';
import { STATUS_MAP_LAYER_TITLE } from './status-config';
import { StatusRecord } from './status-types';
import { PointPlacementStore, PointPlacementService, POINT_PLACEMENT_CONFIG } from '../../shared/point-placement';
import { activateLayer, deactivateLayer, LayerActivationState } from '../../shared/layer-activation-utils';
import { highlightFeatures } from '../../shared/layer-highlight-utils';
import { ViewService } from '../../view/view.service';
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
    DecimalPipe,
    AttributeFormComponent,
    DialogActionsComponent,
    DialogActionComponent,
    ActionBarComponent,
    ActionBarButtonComponent,
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  providers: [
    StatusComponentStore,
    StatusComponentService,
    PointPlacementStore,
    PointPlacementService,
    { provide: POINT_PLACEMENT_CONFIG, useValue: { placingSymbol: STATUS_POINT_PLACING_SYMBOL } },
  ],
  templateUrl: './status.component.html',
  styleUrl: './status.component.scss',
})
export class StatusComponent implements OnDestroy {
  readonly graphic = input.required<Graphic>();

  protected readonly store = inject(StatusComponentStore);
  protected readonly service = inject(StatusComponentService);
  protected readonly geometryStore = inject(PointPlacementStore);
  protected readonly geometryService = inject(PointPlacementService);
  protected readonly viewStore = inject(ViewStore);
  private readonly viewService = inject(ViewService);
  protected readonly confirmingDeleteId = signal<number | undefined>(undefined);
  protected readonly confirmAction = signal<StatusConfirmAction>(null);

  private layerActivationState: LayerActivationState | undefined;
  private highlightHandle: { remove(): void } | undefined;

  protected readonly confirmMessage = computed(() => {
    const action = this.confirmAction();
    if (action === 'save') return 'Are you sure you want to save the status changes?';
    if (action === 'cancel') return 'You have unsaved changes. Are you sure you want to discard them?';
    return undefined;
  });

  protected readonly hasAnyPendingChanges = computed(() => {
    if (this.store.hasPendingChanges()) return true;
    const placedGeo = this.geometryStore.placedGeometry();
    if (!placedGeo) return false;
    const record = this.store.records().find((r) => r.objectId === this.store.activeEditId());
    return placedGeo !== record?.geometry;
  });

  constructor() {
    this.loadOnGraphicChange();
    this.activateLayerOnLoad();
  }

  ngOnDestroy(): void {
    this.highlightHandle?.remove();
    this.deactivateStatusLayer();
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

  private activateLayerOnLoad(): void {
    effect(() => {
      const loading = this.store.loading();
      untracked(() => {
        if (!loading && this.store.available()) {
          this.activateStatusLayer();
          this.highlightStatusRecords();
        }
      });
    });
  }

  private activateStatusLayer(): void {
    const view = this.viewService.activeView();
    if (!view?.map) return;
    this.layerActivationState = activateLayer(view.map, STATUS_MAP_LAYER_TITLE);
  }

  private deactivateStatusLayer(): void {
    const view = this.viewService.activeView();
    if (!view?.map || !this.layerActivationState) return;
    deactivateLayer(view.map, this.layerActivationState);
    this.layerActivationState = undefined;
  }

  private async highlightStatusRecords(): Promise<void> {
    this.highlightHandle?.remove();
    this.highlightHandle = undefined;

    const objectIds = this.store
      .records()
      .filter((r) => !!r.geometry && r.objectId != null)
      .map((r) => r.objectId!);

    const view = this.viewService.activeView();
    if (!view?.map || !objectIds.length) return;

    const layer = view.map.allLayers.find((l) => l instanceof FeatureLayerClass && l.title === STATUS_MAP_LAYER_TITLE);
    if (!layer) return;

    this.highlightHandle = await highlightFeatures(view, layer as FeatureLayer, objectIds);
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
    this.geometryService.cleanup();
    if (record.geometry) {
      this.geometryStore.setPlacedGeometry(record.geometry);
    }
    this.store.startEdit(record);
  }

  protected onFieldChange(event: { fieldName: string; value: AttributeValue }): void {
    this.store.updateField(event.fieldName, event.value);
  }

  protected requestSave(): void {
    this.confirmAction.set('save');
  }

  protected requestCancel(): void {
    if (this.hasAnyPendingChanges()) {
      this.confirmAction.set('cancel');
    } else {
      this.cancelEdit();
    }
  }

  protected requestCancelCreate(): void {
    if (this.hasAnyPendingChanges()) {
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
    this.geometryService.cleanup();
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
    this.geometryService.cleanup();
    this.store.cancelEdit();
  }

  private cancelCreate(): void {
    this.geometryService.cleanup();
    this.store.cancelCreating();
  }

  private async saveEdit(): Promise<void> {
    const geometry = this.geometryStore.placedGeometry();
    this.geometryService.cleanup();
    await this.service.saveRecord(this.graphic(), geometry);
  }

  private async saveCreate(): Promise<void> {
    const graphic = this.graphic();
    const layer = graphic.layer;
    if (!(layer instanceof FeatureLayerClass)) return;

    const parentId = typeof graphic.attributes.id === 'string' ? graphic.attributes.id : undefined;
    if (!parentId) return;

    const geometry = this.geometryStore.placedGeometry();
    this.geometryService.cleanup();
    await this.service.createRecord(graphic, parentId, layer.layerId, geometry);
  }

  protected startPlacing(): void {
    this.geometryService.startPlacing();
  }

  protected adjustGeometry(): void {
    const geo = this.geometryStore.placedGeometry();
    if (geo) {
      this.geometryService.startAdjusting(geo);
    }
  }

  protected removeGeometry(): void {
    this.geometryService.cancelPlacing();
  }

  protected getEffectiveEditGeometry(record: StatusRecord): Point | undefined {
    return this.geometryStore.placedGeometry() ?? record.geometry;
  }
}
