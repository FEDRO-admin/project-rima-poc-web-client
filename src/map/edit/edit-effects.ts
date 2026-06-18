import { computed, effect, inject, Injectable } from '@angular/core';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import type { FeatureEditResult } from '@arcgis/core/editing/types';
import { PopupStore } from '../popup/popup.store';
import { AttributeEditStore } from './attributes/attribute-edit.store';
import { GeometryEditStore } from './geometry/geometry-edit.store';

@Injectable({
  providedIn: 'root',
})
// This is an attempt to follow the same convention for effects as in the popup
// and language effects...
export class EditEffects {
  private readonly popupStore = inject(PopupStore);
  private readonly attributeEditStore = inject(AttributeEditStore);
  private readonly geometryEditStore = inject(GeometryEditStore);

  readonly editing = computed(() => this.attributeEditStore.editing() || this.geometryEditStore.editing());

  readonly isDirty = computed(() => {
    const attributeDirty = this.attributeEditStore.editing() && this.attributeEditStore.isDirty();
    const geometryDirty = this.geometryEditStore.isDirty();
    return attributeDirty || geometryDirty;
  });

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

        this.popupStore.refreshSelectedGraphic();
      });

      onCleanup(() => handle.remove());
    });
  }
}
