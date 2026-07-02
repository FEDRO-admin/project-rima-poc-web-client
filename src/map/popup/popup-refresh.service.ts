import { inject, Injectable } from '@angular/core';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import { PopupStore } from './popup.store';
import { PopupRefreshError } from './popup-errors';

@Injectable({
  providedIn: 'root',
})
export class PopupRefreshService {
  private readonly popupStore = inject(PopupStore);

  async refreshSelectedGraphic(): Promise<void> {
    const graphic = this.popupStore.selectedGraphic();
    if (!graphic) return;

    const layer = graphic.layer;
    if (!(layer instanceof FeatureLayer)) return;

    try {
      const objectId = graphic.attributes[layer.objectIdField];
      const query = layer.createQuery();
      query.objectIds = [objectId];
      query.outFields = ['*'];
      query.returnGeometry = true;

      const featureSet = await layer.queryFeatures(query);
      const refreshedFeature = featureSet.features[0];
      if (refreshedFeature) {
        this.popupStore.replaceSelectedGraphic(refreshedFeature);
      }
    } catch (error) {
      throw new PopupRefreshError(error);
    }
  }
}
