import { computed, effect, inject, Injectable } from '@angular/core';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import type { FeatureEditResult } from '@arcgis/core/editing/types';
import { PopupStore } from '../popup/popup.store';
import { PopupRefreshService } from '../popup/popup-refresh.service';
import { EditStore } from './edit.store';

@Injectable({
  providedIn: 'root',
})
export class EditEffects {
  private readonly popupStore = inject(PopupStore);
  private readonly popupRefreshService = inject(PopupRefreshService);
  private readonly editStore = inject(EditStore);

  readonly editing = computed(() => this.editStore.active());

  readonly isDirty = computed(() => this.editStore.isDirty());

  constructor() {
    this.refreshPopupOnLayerEdits();
  }

  private refreshPopupOnLayerEdits(): void {
    effect((onCleanup) => {
      const graphic = this.popupStore.selectedGraphic();

      if (!graphic) return;

      const layer = graphic.layer;
      if (!(layer instanceof FeatureLayer)) return;

      const objectIdField = layer.objectIdField;
      const objectId = graphic.attributes[objectIdField];

      const handle = layer.on('edits', (event) => {
        const wasUpdated = event.updatedFeatures.some((feature: FeatureEditResult) => feature.objectId === objectId);
        if (!wasUpdated) return;

        this.popupRefreshService.refreshSelectedGraphic();
      });

      onCleanup(() => handle.remove());
    });
  }
}
