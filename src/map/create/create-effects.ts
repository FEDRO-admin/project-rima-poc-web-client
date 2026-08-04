import { effect, inject, Injectable, untracked } from '@angular/core';
import { CreateStore } from './create.store';
import { CreateGeometryService } from './create-geometry.service';
import { ViewStore } from '../view/view.store';
import { ReferencePointService } from '../shared/reference-point/reference-point.service';

@Injectable({
  providedIn: 'root',
})
export class CreateEffects {
  private readonly createStore = inject(CreateStore);
  private readonly createGeometryService = inject(CreateGeometryService);
  private readonly referencePointService = inject(ReferencePointService);
  private readonly viewStore = inject(ViewStore);

  constructor() {
    this.cleanupWhenModeOverridden();
    this.resetModeOnDeactivate();
  }

  private cleanupWhenModeOverridden(): void {
    effect(() => {
      const mode = this.viewStore.interactionMode();
      untracked(() => {
        if (mode !== 'creating' && this.createStore.active()) {
          this.createGeometryService.cancel();
          this.referencePointService.reset();
          this.createStore.reset();
        }
      });
    });
  }

  private resetModeOnDeactivate(): void {
    effect(() => {
      const active = this.createStore.active();
      untracked(() => {
        if (!active && this.viewStore.interactionMode() === 'creating') {
          this.viewStore.setInteractionMode('idle');
        }
      });
    });
  }
}
