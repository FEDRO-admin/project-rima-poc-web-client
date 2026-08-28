import { effect, inject, Injectable, untracked } from '@angular/core';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import type { FeatureEditResult } from '@arcgis/core/editing/types';
import { AttributeEditStore } from './attribute-edit.store';
import { AttributeEditService } from './attribute-edit.service';
import { AttributeDeleteStore } from './attribute-delete.store';
import { PopupStore } from '../popup.store';
import { PopupService } from '../popup.service';
import { ViewStore } from '../../view/view.store';

@Injectable({
  providedIn: 'root',
})
export class AttributesEffects {
  private readonly editStore = inject(AttributeEditStore);
  private readonly editService = inject(AttributeEditService);
  private readonly deleteStore = inject(AttributeDeleteStore);
  private readonly popupStore = inject(PopupStore);
  private readonly popupService = inject(PopupService);
  private readonly viewStore = inject(ViewStore);

  constructor() {
    this.cleanupEditWhenModeOverridden();
    this.resetModeOnEditDeactivate();
    this.refreshPopupOnLayerEdits();
    this.resetModeOnDeleteDeactivate();
    this.cancelDeleteOnPopupClose();
  }

  // ── Edit + Create effects ──

  private cleanupEditWhenModeOverridden(): void {
    effect(() => {
      const mode = this.viewStore.interactionMode();
      untracked(() => {
        if (mode !== 'editing' && this.editStore.active()) {
          this.editService.cleanup();
          this.editStore.reset();
        }
      });
    });
  }

  private resetModeOnEditDeactivate(): void {
    effect(() => {
      const active = this.editStore.active();
      untracked(() => {
        if (!active && this.viewStore.interactionMode() === 'editing') {
          this.viewStore.setInteractionMode('idle');
        }
      });
    });
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

        this.popupService.refreshSelectedGraphic();
      });

      onCleanup(() => handle.remove());
    });
  }

  // ── Delete effects ──

  private resetModeOnDeleteDeactivate(): void {
    effect(() => {
      const active = this.deleteStore.active();
      untracked(() => {
        if (!active && this.viewStore.interactionMode() === 'deleting') {
          this.viewStore.setInteractionMode('idle');
        }
      });
    });
  }

  private cancelDeleteOnPopupClose(): void {
    effect(() => {
      const visible = this.popupStore.visible();
      untracked(() => {
        if (!visible && this.deleteStore.active()) {
          this.deleteStore.reset();
        }
      });
    });
  }
}
