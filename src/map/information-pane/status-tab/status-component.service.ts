import { inject, Injectable } from '@angular/core';
import Graphic from '@arcgis/core/Graphic';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import type Point from '@arcgis/core/geometry/Point';
import { ViewService, type RimaView } from '../../view/view.service';
import { HistoryStore } from '../../history/history.store';
import { ViewStore } from '../../view/view.store';
import { StatusRecord, AttributeValue } from './status-types';
import { StatusLoadError, StatusSaveError } from './status-errors';
import {
  STATUS_FK_PARENT_FIELD,
  STATUS_PARENT_CLASS_NAME_FIELD,
  STATUS_AUTO_POPULATED_FIELDS,
  ZUSTANDSKLASSE_COLORS,
  BEWERTUNGSDATUM_FIELD,
  STATUS_LAYER_NAME,
} from './status-config';
import {
  findStatusRelationshipId,
  findStatusLayer,
  queryStatusRecords,
  resolveStatusEditableFields,
} from './status-resolution';
import { AttributeEditField } from '../../shared/attribute-edit-field';
import { StatusComponentStore, StatusFieldEntry } from './status-component.store';
import { resolveFieldDisplayValue } from '../../layer/layer-attribute-domain-resolver';
import { isImmutableField } from '../../layer/layer-attributes';
import { LayerIdResolver } from '../../layer/layer-id-resolver';

@Injectable()
export class StatusComponentService {
  private readonly viewService = inject(ViewService);
  private readonly historyStore = inject(HistoryStore);
  private readonly viewStore = inject(ViewStore);
  private readonly store = inject(StatusComponentStore);
  private readonly layerIdResolver = inject(LayerIdResolver);

  resolveForView(
    layer: FeatureLayer,
  ): { relationshipId: number; statusLayer: FeatureLayer; fields: AttributeEditField[] } | undefined {
    const view = this.viewService.activeView();
    if (!view) return undefined;

    const statusLayer = this.findStatusLayerSafe(view);
    if (!statusLayer) return undefined;

    const relationshipId = findStatusRelationshipId(layer, statusLayer.layerId);
    if (relationshipId == null) return undefined;

    const fields = resolveStatusEditableFields(statusLayer);
    return { relationshipId, statusLayer, fields };
  }

  private findStatusLayerSafe(view: RimaView): FeatureLayer | undefined {
    try {
      return findStatusLayer(view, this.layerIdResolver.resolveId(STATUS_LAYER_NAME));
    } catch {
      return findStatusLayer(view, -1);
    }
  }

  private resolveParentClassName(layer: FeatureLayer): string {
    try {
      return this.layerIdResolver.resolveName(layer.layerId);
    } catch {
      return layer.title ?? '';
    }
  }

  async loadForGraphic(graphic: Graphic): Promise<void> {
    this.store.reset();

    const layer = graphic.layer;
    if (!(layer instanceof FeatureLayer)) return;

    const resolved = this.resolveForView(layer);
    if (!resolved) return;

    this.store.setup(resolved.relationshipId);
    this.store.setLoading(true);

    try {
      const records = await this.loadStatusRecords(layer, graphic, resolved.relationshipId, resolved.statusLayer);
      this.store.setRecords(records);
    } finally {
      this.store.setLoading(false);
    }
  }

  getStatusLayer(): FeatureLayer | undefined {
    if (this.store.relationshipId() == null) return undefined;
    const view = this.viewService.activeView();
    if (!view) return undefined;
    return this.findStatusLayerSafe(view);
  }

  getFields(): AttributeEditField[] {
    const statusLayer = this.getStatusLayer();
    if (!statusLayer) return [];
    return resolveStatusEditableFields(statusLayer);
  }

  getZustandsklasseForRecord(record: StatusRecord): number | undefined {
    const val = record.attributes['zustandsklasse'];
    return typeof val === 'number' ? val : undefined;
  }

  getZustandsklasseColorForRecord(record: StatusRecord): string | undefined {
    const klasse = this.getZustandsklasseForRecord(record);
    if (klasse == null) return undefined;
    return ZUSTANDSKLASSE_COLORS[klasse];
  }

  getBewertungsdatumDisplay(record: StatusRecord): string | undefined {
    const layer = this.getStatusLayer();
    if (!layer?.fields?.length) return undefined;

    const field = layer.fields.find((f) => f.name.toLowerCase() === BEWERTUNGSDATUM_FIELD);
    if (!field) return undefined;

    const graphic = new Graphic({ attributes: record.attributes, layer });
    const value = resolveFieldDisplayValue(graphic, field, record.attributes[field.name]);
    return value != null ? String(value) : undefined;
  }

  getDisplayFieldsForRecord(record: StatusRecord): StatusFieldEntry[] {
    const layer = this.getStatusLayer();
    if (!layer?.fields?.length) return [];

    const graphic = new Graphic({ attributes: record.attributes, layer });
    return layer.fields
      .filter(
        (field) =>
          !isImmutableField(field.name, layer) && !STATUS_AUTO_POPULATED_FIELDS.includes(field.name.toLowerCase()),
      )
      .map((field) => ({
        label: field.alias || field.name,
        value: resolveFieldDisplayValue(graphic, field, record.attributes[field.name]),
      }));
  }

  async saveRecord(graphic: Graphic, geometry: Point | undefined): Promise<void> {
    const statusLayer = this.getStatusLayer();
    if (!statusLayer) return;

    const activeId = this.store.activeEditId();
    const record = this.store.records().find((r) => r.objectId === activeId);
    if (!record) return;

    this.store.setSaving(true);
    this.viewStore.setSaving(true);
    try {
      await this.applyUpdate(statusLayer, record, this.store.editedAttributes(), geometry);
    } finally {
      this.store.setSaving(false);
      this.viewStore.setSaving(false);
    }

    await this.loadForGraphic(graphic);
  }

  async deleteRecord(graphic: Graphic, objectId: number): Promise<void> {
    const statusLayer = this.getStatusLayer();
    if (!statusLayer) return;

    this.store.setSaving(true);
    this.viewStore.setSaving(true);
    try {
      await this.applyDelete(statusLayer, objectId);
    } finally {
      this.store.setSaving(false);
      this.viewStore.setSaving(false);
    }

    await this.loadForGraphic(graphic);
  }

  async createRecord(graphic: Graphic, parentId: string, layerId: number, geometry: Point | undefined): Promise<void> {
    const statusLayer = this.getStatusLayer();
    if (!statusLayer) return;

    const parentLayerName = this.resolveParentClassName(graphic.layer as FeatureLayer);
    this.store.setSaving(true);
    this.viewStore.setSaving(true);
    try {
      await this.applyCreate(statusLayer, parentId, parentLayerName, this.store.editedAttributes(), geometry);
    } finally {
      this.store.setSaving(false);
      this.viewStore.setSaving(false);
    }

    await this.loadForGraphic(graphic);
  }

  private async loadStatusRecords(
    layer: FeatureLayer,
    graphic: Graphic,
    relationshipId: number,
    statusLayer: FeatureLayer,
  ): Promise<StatusRecord[]> {
    try {
      const historicMoment = this.historyStore.selectedDate() ?? undefined;
      return await queryStatusRecords(layer, graphic, relationshipId, statusLayer, historicMoment);
    } catch (error) {
      throw new StatusLoadError(error);
    }
  }

  private async applyUpdate(
    statusLayer: FeatureLayer,
    record: StatusRecord,
    editedAttributes: Record<string, AttributeValue>,
    geometry: Point | undefined,
  ): Promise<void> {
    try {
      const updateGraphic = new Graphic({
        attributes: {
          [statusLayer.objectIdField]: record.objectId,
          ...editedAttributes,
        },
        geometry: geometry ?? undefined,
      });

      const result = await statusLayer.applyEdits({ updateFeatures: [updateGraphic] });
      const updateResult = result.updateFeatureResults[0];
      if (updateResult?.error) {
        throw new StatusSaveError(updateResult.error);
      }
    } catch (error) {
      if (error instanceof StatusSaveError) throw error;
      throw new StatusSaveError(error);
    }
  }

  private async applyCreate(
    statusLayer: FeatureLayer,
    parentId: string,
    parentClassName: string,
    attributes: Record<string, AttributeValue>,
    geometry: Point | undefined,
  ): Promise<void> {
    try {
      const addGraphic = new Graphic({
        attributes: {
          ...attributes,
          [STATUS_FK_PARENT_FIELD]: parentId,
          [STATUS_PARENT_CLASS_NAME_FIELD]: parentClassName,
        },
        geometry: geometry ?? undefined,
      });

      const result = await statusLayer.applyEdits({ addFeatures: [addGraphic] });
      const addResult = result.addFeatureResults[0];
      if (addResult?.error) {
        throw new StatusSaveError(addResult.error);
      }
    } catch (error) {
      if (error instanceof StatusSaveError) throw error;
      throw new StatusSaveError(error);
    }
  }

  private async applyDelete(statusLayer: FeatureLayer, objectId: number): Promise<void> {
    try {
      const deleteGraphic = new Graphic({
        attributes: { [statusLayer.objectIdField]: objectId },
      });

      const result = await statusLayer.applyEdits({ deleteFeatures: [deleteGraphic] });
      const deleteResult = result.deleteFeatureResults[0];
      if (deleteResult?.error) {
        throw new StatusSaveError(deleteResult.error);
      }
    } catch (error) {
      if (error instanceof StatusSaveError) throw error;
      throw new StatusSaveError(error);
    }
  }
}
