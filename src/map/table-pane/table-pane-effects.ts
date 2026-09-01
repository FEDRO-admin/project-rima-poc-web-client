import { effect, inject, Injectable, untracked } from '@angular/core';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import { TablePaneStore } from './table-pane.store';
import { TablePaneService } from './table-pane.service';
import { ViewStore } from '../view/view.store';

@Injectable({
  providedIn: 'root',
})
export class TablePaneEffects {
  private readonly store = inject(TablePaneStore);
  private readonly service = inject(TablePaneService);
  private readonly viewStore = inject(ViewStore);

  constructor() {
    this.clearHighlightsOnClose();
    this.closeOnViewModeSwitch();
  }

  private clearHighlightsOnClose(): void {
    effect(() => {
      const visible = this.store.visible();
      untracked(() => {
        if (!visible) {
          this.service.clearAllHighlights();
        }
      });
    });
  }

  private closeOnViewModeSwitch(): void {
    effect(() => {
      const mode = this.viewStore.mode();
      untracked(() => {
        if (!this.store.visible()) return;
        const layer = this.store.layer();
        if (!layer) return;
        // Close if switching to scene and layer is not Z-enabled
        if (mode === 'scene' && layer instanceof FeatureLayer && !layer.hasZ) {
          this.service.closeTable();
        }
      });
    });
  }
}
