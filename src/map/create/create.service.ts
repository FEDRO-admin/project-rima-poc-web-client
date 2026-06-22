import { inject, Injectable } from '@angular/core';
import Graphic from '@arcgis/core/Graphic';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import { CreateStore } from './create.store';
import { CreateGeometryService } from './create-geometry.service';
import { CreateSaveError } from './create-errors';
import { isSystemField } from '../edit/edit-capability';

type AttributeValue = string | number | boolean | null;

@Injectable({
  providedIn: 'root',
})
export class CreateService {
  private readonly createStore = inject(CreateStore);
  private readonly createGeometryService = inject(CreateGeometryService);

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
    this.createStore.reset();
  }

  private buildCreatePayload(
    layer: FeatureLayer,
    attributes: Record<string, AttributeValue>,
  ): Record<string, AttributeValue> {
    const payload: Record<string, AttributeValue> = {};

    for (const [key, value] of Object.entries(attributes)) {
      if (!isSystemField(key) && key !== layer.objectIdField) {
        payload[key] = value;
      }
    }

    return payload;
  }
}
