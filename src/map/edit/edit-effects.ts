import { effect, inject, Injectable, untracked } from '@angular/core';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import type { FeatureEditResult } from '@arcgis/core/editing/types';
import { PopupStore } from '../popup/popup.store';
import { EditStore } from './edit.store';
import { EditService } from './edit.service';
import { ViewStore } from '../view/view.store';
import { PopupService } from '../popup/popup.service';

@Injectable({
  providedIn: 'root',
})
export class EditEffects {
  private readonly popupStore = inject(PopupStore);
  private readonly popupService = inject(PopupService);
  private readonly editStore = inject(EditStore);
  private readonly editService = inject(EditService);
  private readonly viewStore = inject(ViewStore);

  constructor() {
    this.cleanupWhenModeOverridden();
    this.resetModeOnDeactivate();
    this.refreshPopupOnLayerEdits();
  }

  private cleanupWhenModeOverridden(): void {
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

  private resetModeOnDeactivate(): void {
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
}
