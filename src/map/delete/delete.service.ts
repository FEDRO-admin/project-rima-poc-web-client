import { inject, Injectable } from '@angular/core';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import Graphic from '@arcgis/core/Graphic';
import { DeleteStore } from './delete.store';
import { PopupStore } from '../popup/popup.store';
import { DeleteFeatureError } from './delete-errors';

@Injectable({
  providedIn: 'root',
})
export class DeleteService {
  private readonly store = inject(DeleteStore);
  private readonly popupStore = inject(PopupStore);

  requestDelete(graphic: Graphic): void {
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
        throw new DeleteFeatureError(deleteResult.error);
      }

      layer.refresh();
      this.popupStore.close();
      this.store.reset();
    } catch (error) {
      this.store.setDeleting(false);
      if (error instanceof DeleteFeatureError) {
        throw error;
      }
      throw new DeleteFeatureError(error);
    }
  }

  cancelDelete(): void {
    this.store.reset();
  }
}
