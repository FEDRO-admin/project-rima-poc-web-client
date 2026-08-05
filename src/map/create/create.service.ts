import { inject, Injectable } from '@angular/core';
import Graphic from '@arcgis/core/Graphic';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import { CreateStore } from './create.store';
import { CreateGeometryService } from './create-geometry.service';
import { CreateSaveError, CreateFormLoadError as SaveAndOpenPopupError } from './create-errors';
import { isImmutableField } from '../layer/layer-attributes';
import { PopupStore } from '../popup/popup.store';
import { ViewStore } from '../view/view.store';

type AttributeValue = string | number | boolean | null;

@Injectable({
  providedIn: 'root',
})
export class CreateService {
  private readonly createStore = inject(CreateStore);
  private readonly viewStore = inject(ViewStore);
  private readonly createGeometryService = inject(CreateGeometryService);
  private readonly popupStore = inject(PopupStore);

  async saveAndOpenInPopup(): Promise<void> {
    const layer = this.createStore.layer();
    if (!(layer instanceof FeatureLayer)) return;

    const geometry = this.createStore.geometry();
    if (!geometry) return;

    this.viewStore.setSaving(true);

    try {
      this.createGeometryService.cleanup();

      const attributes = this.buildCreatePayload(layer, this.createStore.attributes());
      const graphic = new Graphic({ attributes, geometry });

      const result = await layer.applyEdits({ addFeatures: [graphic] });
      const addResult = result.addFeatureResults[0];

      if (addResult?.error) {
        throw new CreateSaveError(addResult.error);
      }

      const objectId = addResult?.objectId;
      if (objectId == null) {
        this.viewStore.setSaving(false);
        this.createStore.reset();
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
      this.createStore.reset();
    } catch (error) {
      this.viewStore.setSaving(false);
      if (error instanceof CreateSaveError) {
        throw error;
      }
      throw new SaveAndOpenPopupError(error);
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
      if (!isImmutableField(key, layer) && key !== layer.objectIdField) {
        payload[key] = value;
      }
    }

    return payload;
  }
}
