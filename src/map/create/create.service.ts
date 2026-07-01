import { inject, Injectable } from '@angular/core';
import Graphic from '@arcgis/core/Graphic';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import { CreateStore } from './create.store';
import { CreateGeometryService } from './create-geometry.service';
import { CreateSaveError, CreateFormLoadError as SaveAndOpenPopupError } from './create-errors';
import { isImmutableField } from '../layer/layer-attributes';
import { PopupStore } from '../popup/popup.store';
import { ReferencePointService } from '../shared/reference-point/reference-point.service';

type AttributeValue = string | number | boolean | null;

@Injectable({
  providedIn: 'root',
})
export class CreateService {
  private readonly createStore = inject(CreateStore);
  private readonly createGeometryService = inject(CreateGeometryService);
  private readonly popupStore = inject(PopupStore);
  private readonly referencePointService = inject(ReferencePointService);

  async save(): Promise<number | undefined> {
    const layer = this.createStore.layer();
    if (!(layer instanceof FeatureLayer)) return undefined;

    const geometry = this.createStore.geometry();
    if (!geometry) return undefined;

    this.createStore.setSaving(true);

    try {
      this.createGeometryService.cleanup();

      const attributes = this.buildCreatePayload(layer, this.createStore.attributes());
      const subtypeField = this.createStore.subtypeField();
      const subtypeValue = this.createStore.subtypeValue();
      if (subtypeField && subtypeValue != null) {
        attributes[subtypeField] = subtypeValue;
      }
      const graphic = new Graphic({ attributes, geometry });

      const result = await layer.applyEdits({ addFeatures: [graphic] });

      const addResult = result.addFeatureResults[0];

      if (addResult?.error) {
        throw new CreateSaveError(addResult.error);
      }

      const objectId = addResult?.objectId ?? undefined;
      this.createStore.reset();
      return objectId;
    } catch (error) {
      this.createStore.setSaving(false);
      if (error instanceof CreateSaveError) {
        throw error;
      }
      throw new CreateSaveError(error);
    }
  }

  cancel(): void {
    this.createGeometryService.cancel();
    this.referencePointService.reset();
    this.createStore.reset();
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

  async saveAndOpenInPopup(): Promise<void> {
    const layer = this.createStore.layer();
    if (!(layer instanceof FeatureLayer)) return;

    try {
      const objectId = await this.save();
      if (objectId == null) return;

      layer.refresh();

      const query = layer.createQuery();
      query.objectIds = [objectId];
      query.outFields = ['*'];
      query.returnGeometry = true;

      const featureSet = await layer.queryFeatures(query);
      const graphic = featureSet.features[0];
      if (graphic) {
        // Save reference points with the new feature's id
        const parentId = graphic.attributes.id;
        if (parentId) {
          await this.referencePointService.saveAll(parentId);
        }
        this.referencePointService.reset();
        this.popupStore.open([graphic]);
      }
    } catch (error) {
      throw new SaveAndOpenPopupError(error);
    }
  }
}
