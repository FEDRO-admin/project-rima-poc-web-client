import { computed, effect, inject, Injectable, untracked } from '@angular/core';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import { CreateStore } from './create.store';
import { CreateService } from './create.service';
import { PopupStore } from '../popup/popup.store';
import { EditEffects } from '../edit/edit-effects';
import { AttributeEditStore } from '../edit/attributes/attribute-edit.store';
import { GeometryEditService } from '../edit/geometry/geometry-edit.service';

@Injectable({
  providedIn: 'root',
})
export class CreateEffects {
  private readonly createStore = inject(CreateStore);
  private readonly createService = inject(CreateService);
  private readonly popupStore = inject(PopupStore);
  private readonly editEffects = inject(EditEffects);
  private readonly attributeEditStore = inject(AttributeEditStore);
  private readonly geometryEditService = inject(GeometryEditService);

  readonly creating = computed(() => this.createStore.active());

  constructor() {
    this.closePopupOnCreate();
    this.cancelEditsOnCreate();
  }

  async saveAndOpenInPopup(): Promise<void> {
    const layer = this.createStore.layer();
    if (!(layer instanceof FeatureLayer)) return;

    try {
      const objectId = await this.createService.save();
      if (objectId == null) return;

      layer.refresh();

      const query = layer.createQuery();
      query.objectIds = [objectId];
      query.outFields = ['*'];
      query.returnGeometry = true;

      const featureSet = await layer.queryFeatures(query);
      const graphic = featureSet.features[0];
      if (graphic) {
        this.popupStore.open([graphic]);
      }
    } catch (error) {
      console.error('[CreateEffects] saveAndOpenInPopup failed:', error);
    }
  }

  private closePopupOnCreate(): void {
    effect(() => {
      const active = this.createStore.active();
      untracked(() => {
        if (active) {
          this.popupStore.close();
        }
      });
    });
  }

  private cancelEditsOnCreate(): void {
    effect(() => {
      const active = this.createStore.active();
      untracked(() => {
        if (active && this.editEffects.editing()) {
          this.attributeEditStore.reset();
          this.geometryEditService.cancel();
        }
      });
    });
  }
}
