import { inject, Injectable } from '@angular/core';
import Graphic from '@arcgis/core/Graphic';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import { EditStore } from './edit.store';
import { GeometryEditService } from './geometry/geometry-edit.service';
import { EditSaveError, EditRefreshError } from './edit-errors';
import { isSystemField } from './edit-capability';
import { PopupStore } from '../popup/popup.store';

type AttributeValue = string | number | boolean | null;

@Injectable({
  providedIn: 'root',
})
export class EditService {
  private readonly editStore = inject(EditStore);
  private readonly geometryEditService = inject(GeometryEditService);
  private readonly popupStore = inject(PopupStore);

  async save(): Promise<void> {
    const graphic = this.editStore.graphic();
    if (!graphic) return;

    const layer = graphic.layer;
    if (!(layer instanceof FeatureLayer)) return;

    this.editStore.setSaving(true);

    try {
      // Deactivate geometry sketching before saving
      if (this.editStore.allowsGeometryEditing()) {
        this.geometryEditService.deactivate();
      }

      const updatedAttributes = this.buildUpdatePayload(graphic, this.editStore.editedAttributes());
      const updatedGeometry = this.editStore.editedGeometry() ?? graphic.geometry;
      const updateGraphic = new Graphic({
        attributes: updatedAttributes,
        geometry: updatedGeometry,
      });

      const result = await layer.applyEdits({ updateFeatures: [updateGraphic] });
      const updateResult = result.updateFeatureResults[0];

      if (updateResult?.error) {
        throw new EditSaveError(updateResult.error);
      }

      await this.refreshGraphicInPopup(graphic, layer);
      this.editStore.reset();
    } catch (error) {
      this.editStore.setSaving(false);
      if (error instanceof EditSaveError) {
        throw error;
      }
      throw new EditSaveError(error);
    }
  }

  cancel(): void {
    if (this.editStore.allowsGeometryEditing()) {
      this.geometryEditService.deactivate();
    }
    this.editStore.reset();
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

  private async refreshGraphicInPopup(graphic: Graphic, layer: FeatureLayer): Promise<void> {
    try {
      const objectIdField = layer.objectIdField;
      const objectId = graphic.attributes[objectIdField];

      const query = layer.createQuery();
      query.objectIds = [objectId];
      query.outFields = ['*'];
      query.returnGeometry = true;

      const featureSet = await layer.queryFeatures(query);
      const refreshedFeature = featureSet.features[0];

      if (refreshedFeature) {
        // Update the graphic in the popup store's graphics array
        const graphics = this.popupStore.graphics();
        const selectedIndex = this.popupStore.selectedIndex();

        if (selectedIndex != null) {
          const updatedGraphics = [...graphics];
          updatedGraphics[selectedIndex] = refreshedFeature;
          this.popupStore.open(updatedGraphics);
          this.popupStore.selectFeature(selectedIndex);
        }
      }
    } catch (error) {
      throw new EditRefreshError(error);
    }
  }
}
