import { effect, inject, Injectable, untracked } from '@angular/core';
import { SceneStore } from './scene.store';
import { PopupStore } from '../popup/popup.store';
import { EditService } from '../edit/edit.service';
import { EditEffects } from '../edit/edit-effects';
import { CreateEffects } from '../create/create-effects';
import { CreateStore } from '../create/create.store';
import { HistoryEffects } from '../history/history-effects';
import { HistoryStore } from '../history/history.store';

@Injectable({
  providedIn: 'root',
})
export class SceneEffects {
  private readonly sceneStore = inject(SceneStore);
  private readonly popupStore = inject(PopupStore);
  private readonly editService = inject(EditService);
  private readonly editEffects = inject(EditEffects);
  private readonly createEffects = inject(CreateEffects);
  private readonly createStore = inject(CreateStore);
  private readonly historyEffects = inject(HistoryEffects);
  private readonly historyStore = inject(HistoryStore);

  constructor() {
    this.cancelActiveModesOnSwitch();
  }

  private cancelActiveModesOnSwitch(): void {
    effect(() => {
      const _mode = this.sceneStore.mode();
      untracked(() => {
        this.popupStore.close();

        if (this.editEffects.editing()) {
          this.editService.reset();
        }

        if (this.createEffects.creating()) {
          this.createStore.reset();
        }

        if (this.historyEffects.active()) {
          this.historyStore.deactivate();
        }
      });
    });
  }
}
