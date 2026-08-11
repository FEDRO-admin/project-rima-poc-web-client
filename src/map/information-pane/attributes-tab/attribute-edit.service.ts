import { inject, Injectable, OnDestroy } from '@angular/core';
import Graphic from '@arcgis/core/Graphic';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import { AttributeEditStore } from './attribute-edit.store';
import { AttributeGeometryService } from './attribute-geometry.service';
import { PopupStore } from '../popup.store';
import { PopupService } from '../popup.service';
import { ViewStore } from '../../view/view.store';
import { AttributeEditSaveError, AttributeCreateSaveError, AttributeCreateOpenError } from './attributes-errors';
import { isImmutableField } from '../../layer/layer-attributes';

type AttributeValue = string | number | boolean | null;

@Injectable({
  providedIn: 'root',
})
export class AttributeEditService implements OnDestroy {
  private readonly store = inject(AttributeEditStore);
  private readonly viewStore = inject(ViewStore);
  private readonly popupStore = inject(PopupStore);
  private readonly popupService = inject(PopupService);
  private readonly geometryService = inject(AttributeGeometryService);

  ngOnDestroy(): void {
    this.store.reset();
  }

  activateEdit(graphic: Graphic): void {
    this.cleanup();
    this.viewStore.setInteractionMode('editing');
    this.store.activateEdit(graphic);
    this.geometryService.showHighlight(graphic.geometry!);
  }

  activateCreate(layer: FeatureLayer): void {
    this.cleanup();
    this.popupStore.close();
    this.viewStore.setInteractionMode('editing');
    this.store.activateCreate(layer);
  }

  async save(): Promise<void> {
    if (this.store.isEditing()) {
      await this.saveEdit();
    } else if (this.store.isCreating()) {
      await this.saveCreate();
    }
  }

  cancel(): void {
    this.cleanup();
  }

  cleanup(): void {
    this.geometryService.cleanup();
    this.store.reset();
  }

  // ── Geometry delegates ──

  startGeometryEditing(): void {
    this.geometryService.startEditing();
  }

  confirmGeometry(): void {
    this.geometryService.confirmGeometry();
  }

  discardGeometry(): void {
    this.geometryService.discardGeometry();
  }

  reenterSketch(): void {
    this.geometryService.reenterEditSketch();
  }

  startDrawing(layer: FeatureLayer, tool?: import('@arcgis/core/widgets/Sketch/types').CreateTool): void {
    this.geometryService.startDrawing(layer, tool);
  }

  redraw(layer: FeatureLayer, tool?: import('@arcgis/core/widgets/Sketch/types').CreateTool): void {
    this.geometryService.redraw(layer, tool);
  }

  confirmPlacement(): void {
    this.geometryService.confirmPlacement();
  }

  reenterAdjusting(): void {
    this.geometryService.reenterAdjusting();
  }

  clearGeometry(): void {
    this.geometryService.cleanup();
    this.store.clearGeometry();
  }

  undo(): void {
    this.geometryService.undo();
  }

  redo(): void {
    this.geometryService.redo();
  }

  // ── Private ──

  private async saveEdit(): Promise<void> {
    const graphic = this.store.graphic();
    if (!graphic) return;

    const layer = graphic.layer;
    if (!(layer instanceof FeatureLayer)) return;

    this.viewStore.setSaving(true);

    try {
      this.geometryService.cleanup();

      const updateAttributes = this.buildUpdatePayload(graphic, this.store.editedAttributes());
      const editedGeometry = this.store.editedGeometry();

      const updateGraphic = new Graphic({
        attributes: updateAttributes,
        geometry: editedGeometry ?? undefined,
      });

      const result = await layer.applyEdits({ updateFeatures: [updateGraphic] });
      const updateResult = result.updateFeatureResults[0];

      if (updateResult?.error) {
        throw new AttributeEditSaveError(updateResult.error);
      }

      layer.refresh();
      this.viewStore.setSaving(false);
      this.store.reset();

      await this.popupService.refreshSelectedGraphic();
    } catch (error) {
      this.viewStore.setSaving(false);
      if (error instanceof AttributeEditSaveError) throw error;
      throw new AttributeEditSaveError(error);
    }
  }

  private async saveCreate(): Promise<void> {
    const layer = this.store.layer();
    if (!(layer instanceof FeatureLayer)) return;

    const geometry = this.store.editedGeometry();
    if (!geometry) return;

    this.viewStore.setSaving(true);

    try {
      this.geometryService.cleanup();

      const attributes = this.buildCreatePayload(layer, this.store.editedAttributes());
      const graphic = new Graphic({ attributes, geometry });

      const result = await layer.applyEdits({ addFeatures: [graphic] });
      const addResult = result.addFeatureResults[0];

      if (addResult?.error) {
        throw new AttributeCreateSaveError(addResult.error);
      }

      const objectId = addResult?.objectId;
      if (objectId == null) {
        this.viewStore.setSaving(false);
        this.store.reset();
        return;
      }

      layer.refresh();

      const query = layer.createQuery();
      query.objectIds = [objectId];
      query.outFields = ['*'];
      query.returnGeometry = true;

      const featureSet = await layer.queryFeatures(query);
      const created = featureSet.features[0];
      if (created) {
        this.popupStore.open([created]);
      }

      this.viewStore.setSaving(false);
      this.store.reset();
    } catch (error) {
      this.viewStore.setSaving(false);
      if (error instanceof AttributeCreateSaveError) throw error;
      throw new AttributeCreateOpenError(error);
    }
  }

  private buildUpdatePayload(
    graphic: Graphic,
    editedAttributes: Record<string, AttributeValue>,
  ): Record<string, AttributeValue> {
    const layer = graphic.layer as FeatureLayer;
    const payload: Record<string, AttributeValue> = {};
    const objectIdField = layer.objectIdField;

    payload[objectIdField] = graphic.attributes[objectIdField];

    for (const [key, value] of Object.entries(editedAttributes)) {
      if (!isImmutableField(key, layer) && key !== objectIdField) {
        payload[key] = value;
      }
    }

    return payload;
  }

  private buildCreatePayload(
    layer: FeatureLayer,
    attributes: Record<string, AttributeValue>,
  ): Record<string, AttributeValue> {
    const payload: Record<string, AttributeValue> = {};

    for (const [key, value] of Object.entries(attributes)) {
      if (!isImmutableField(key, layer) && key !== layer.objectIdField) {
        payload[key] = value;
      }
    }

    return payload;
  }
}
