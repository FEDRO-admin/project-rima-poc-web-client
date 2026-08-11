import { inject, Injectable } from '@angular/core';
import Graphic from '@arcgis/core/Graphic';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import { ViewService } from '../../view/view.service';
import { HistoryStore } from '../../history/history.store';
import { ViewStore } from '../../view/view.store';
import { StatusRecord, AttributeValue } from './status-types';
import { StatusLoadError, StatusSaveError } from './status-errors';
import {
  STATUS_FK_PARENT_FIELD,
  STATUS_PARENT_CLASS_NAME_FIELD,
  STATUS_AUTO_POPULATED_FIELDS,
  ZUSTANDSKLASSE_COLORS,
} from './status-config';
import {
  findStatusRelationshipId,
  findStatusLayer,
  queryStatusRecord,
  resolveStatusEditableFields,
} from './status-resolution';
import { AttributeEditField } from '../../shared/attribute-edit-field';
import { StatusComponentStore, StatusFieldEntry } from './status-component.store';
import { resolveFieldDisplayValue } from '../../layer/layer-attribute-domain-resolver';
import { isImmutableField } from '../../layer/layer-attributes';

@Injectable()
export class StatusComponentService {
  private readonly viewService = inject(ViewService);
  private readonly historyStore = inject(HistoryStore);
  private readonly viewStore = inject(ViewStore);
  private readonly store = inject(StatusComponentStore);

  resolveForView(
    layer: FeatureLayer,
  ): { relationshipId: number; statusLayer: FeatureLayer; fields: AttributeEditField[] } | undefined {
    const view = this.viewService.activeView();
    if (!view) return undefined;

    const relationshipId = findStatusRelationshipId(layer);
    if (relationshipId == null) return undefined;

    const statusLayer = findStatusLayer(view);
    if (!statusLayer) return undefined;

    const fields = resolveStatusEditableFields(statusLayer);
    return { relationshipId, statusLayer, fields };
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
      const record = await this.loadStatus(layer, graphic, resolved.relationshipId, resolved.statusLayer);
      this.store.setRecord(record);
    } finally {
      this.store.setLoading(false);
    }
  }

  getStatusLayer(): FeatureLayer | undefined {
    if (this.store.relationshipId() == null) return undefined;
    const view = this.viewService.activeView();
    if (!view) return undefined;
    return findStatusLayer(view);
  }

  getFields(): AttributeEditField[] {
    const statusLayer = this.getStatusLayer();
    if (!statusLayer) return [];
    return resolveStatusEditableFields(statusLayer);
  }

  getZustandsklasse(): number | undefined {
    const rec = this.store.record();
    if (!rec) return undefined;
    const val = rec.attributes['zustandsklasse'];
    return typeof val === 'number' ? val : undefined;
  }

  getZustandsklasseColor(): string | undefined {
    const klasse = this.getZustandsklasse();
    if (klasse == null) return undefined;
    return ZUSTANDSKLASSE_COLORS[klasse];
  }

  getDisplayFields(): StatusFieldEntry[] {
    const rec = this.store.record();
    const layer = this.getStatusLayer();
    if (!rec || !layer?.fields?.length) return [];

    const graphic = new Graphic({ attributes: rec.attributes, layer });
    return layer.fields
      .filter(
        (field) =>
          !isImmutableField(field.name, layer) && !STATUS_AUTO_POPULATED_FIELDS.includes(field.name.toLowerCase()),
      )
      .map((field) => ({
        label: field.alias || field.name,
        value: resolveFieldDisplayValue(graphic, field, rec.attributes[field.name]),
      }));
  }

  async loadStatus(
    layer: FeatureLayer,
    graphic: Graphic,
    relationshipId: number,
    statusLayer: FeatureLayer,
  ): Promise<StatusRecord | undefined> {
    try {
      const historicMoment = this.historyStore.selectedDate() ?? undefined;
      return await queryStatusRecord(layer, graphic, relationshipId, statusLayer, historicMoment);
    } catch (error) {
      throw new StatusLoadError(error);
    }
  }

  async saveStatus(
    statusLayer: FeatureLayer,
    record: StatusRecord,
    editedAttributes: Record<string, AttributeValue>,
  ): Promise<void> {
    try {
      const updateGraphic = new Graphic({
        attributes: {
          [statusLayer.objectIdField]: record.objectId,
          ...editedAttributes,
        },
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

  async createStatus(
    statusLayer: FeatureLayer,
    parentId: string,
    parentClassName: string,
    attributes: Record<string, AttributeValue>,
  ): Promise<void> {
    try {
      const addGraphic = new Graphic({
        attributes: {
          ...attributes,
          [STATUS_FK_PARENT_FIELD]: parentId,
          [STATUS_PARENT_CLASS_NAME_FIELD]: parentClassName,
        },
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

  async deleteStatus(statusLayer: FeatureLayer, objectId: number): Promise<void> {
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

  async save(graphic: Graphic, parentId: string | undefined, layerId: number): Promise<void> {
    const statusLayer = this.getStatusLayer();
    if (!statusLayer) return;

    this.store.setSaving(true);
    this.viewStore.setSaving(true);
    try {
      if (this.store.deleted()) {
        const record = this.store.record();
        if (record?.objectId != null) {
          await this.deleteStatus(statusLayer, record.objectId);
        }
      } else if (this.store.creating()) {
        if (parentId) {
          await this.createStatus(statusLayer, parentId, String(layerId), this.store.editedAttributes());
        }
      } else if (this.store.hasPendingChanges()) {
        const record = this.store.record();
        if (record) {
          await this.saveStatus(statusLayer, record, this.store.editedAttributes());
        }
      }
    } finally {
      this.store.setSaving(false);
      this.viewStore.setSaving(false);
    }

    // Reload always runs after a successful save; reset() (inside loadForGraphic) restores saving to false too.
    await this.loadForGraphic(graphic);
  }
}
