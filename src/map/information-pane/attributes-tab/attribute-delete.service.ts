import { inject, Injectable } from '@angular/core';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import Graphic from '@arcgis/core/Graphic';
import { AttributeDeleteStore } from './attribute-delete.store';
import { PopupStore } from '../popup.store';
import { ViewStore } from '../../view/view.store';
import { AttributeDeleteError } from './attributes-errors';

@Injectable({
  providedIn: 'root',
})
export class AttributeDeleteService {
  private readonly store = inject(AttributeDeleteStore);
  private readonly viewStore = inject(ViewStore);
  private readonly popupStore = inject(PopupStore);

  requestDelete(graphic: Graphic): void {
    this.viewStore.setInteractionMode('deleting');
    this.store.requestDelete(graphic);
  }

  async confirmDelete(): Promise<void> {
    const graphic = this.store.graphic();
    if (!graphic) return;

    const layer = graphic.layer;
    if (!(layer instanceof FeatureLayer)) return;

    this.store.setDeleting(true);

    try {
      const objectIdField = layer.objectIdField;
      const objectId = graphic.attributes[objectIdField];

      const deleteGraphic = new Graphic({
        attributes: { [objectIdField]: objectId },
      });

      const result = await layer.applyEdits({ deleteFeatures: [deleteGraphic] });
      const deleteResult = result.deleteFeatureResults[0];

      if (deleteResult?.error) {
        throw new AttributeDeleteError(deleteResult.error);
      }

      layer.refresh();
      this.popupStore.close();
      this.store.reset();
    } catch (error) {
      this.store.setDeleting(false);
      if (error instanceof AttributeDeleteError) throw error;
      throw new AttributeDeleteError(error);
    }
  }

  cancelDelete(): void {
    this.store.reset();
  }
}
