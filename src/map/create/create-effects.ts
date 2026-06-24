import { computed, effect, inject, Injectable, untracked } from '@angular/core';
import { CreateStore } from './create.store';
import { PopupStore } from '../popup/popup.store';
import { EditEffects } from '../edit/edit-effects';
import { AttributeEditStore } from '../edit/attributes/attribute-edit.store';
import { GeometryEditService } from '../edit/geometry/geometry-edit.service';

@Injectable({
  providedIn: 'root',
})
export class CreateEffects {
  private readonly createStore = inject(CreateStore);
  private readonly popupStore = inject(PopupStore);
  private readonly editEffects = inject(EditEffects);
  private readonly attributeEditStore = inject(AttributeEditStore);
  private readonly geometryEditService = inject(GeometryEditService);

  readonly creating = computed(() => this.createStore.active());

  constructor() {
    this.closePopupOnCreate();
    this.cancelEditsOnCreate();
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
