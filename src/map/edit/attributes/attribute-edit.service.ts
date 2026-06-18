import { inject, Injectable } from '@angular/core';
import Graphic from '@arcgis/core/Graphic';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import { AttributeEditStore } from './attribute-edit.store';
import { EditSaveError } from '../edit-errors';
import { isSystemField } from '../edit-capability';

type AttributeValue = string | number | boolean | null;

@Injectable({
  providedIn: 'root',
})
export class AttributeEditService {
  private readonly attributeEditStore = inject(AttributeEditStore);

  async save(): Promise<void> {
    const graphic = this.attributeEditStore.graphic();
    if (!graphic) return;

    const layer = graphic.layer;
    if (!(layer instanceof FeatureLayer)) return;

    this.attributeEditStore.setSaving(true);

    try {
      const updatedAttributes = this.buildUpdatePayload(graphic, this.attributeEditStore.editedAttributes());
      const updateGraphic = new Graphic({
        attributes: updatedAttributes,
      });

      const result = await layer.applyEdits({ updateFeatures: [updateGraphic] });
      const updateResult = result.updateFeatureResults[0];

      if (updateResult?.error) {
        throw new EditSaveError(updateResult.error);
      }

      this.attributeEditStore.reset();
    } catch (error) {
      this.attributeEditStore.setSaving(false);
      if (error instanceof EditSaveError) {
        throw error;
      }
      throw new EditSaveError(error);
    }
  }

  cancel(): void {
    this.attributeEditStore.reset();
  }

  private buildUpdatePayload(
    graphic: Graphic,
    editedAttributes: Record<string, AttributeValue>,
  ): Record<string, AttributeValue> {
    const payload: Record<string, AttributeValue> = {};
    const objectIdField = this.getObjectIdFieldName(graphic);

    // Always include the object ID so the server knows which feature to update
    if (objectIdField) {
      payload[objectIdField] = graphic.attributes[objectIdField];
    }

    // Include only editable, non-system fields
    for (const [key, value] of Object.entries(editedAttributes)) {
      if (!isSystemField(key) && key !== objectIdField) {
        payload[key] = value;
      }
    }

    return payload;
  }

  private getObjectIdFieldName(graphic: Graphic): string | undefined {
    const layer = graphic.layer;
    if (layer instanceof FeatureLayer) {
      return layer.objectIdField;
    }
    return undefined;
  }
}
