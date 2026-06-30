import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { computed } from '@angular/core';
import Graphic from '@arcgis/core/Graphic';

interface DeleteState {
  graphic: Graphic | null;
  deleting: boolean;
  confirmRequested: boolean;
}

const initialState: DeleteState = {
  graphic: null,
  deleting: false,
  confirmRequested: false,
};

export const DeleteStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed((store) => ({
    active: computed(() => store.graphic() != null),
  })),
  withMethods((store) => ({
    requestDelete(graphic: Graphic): void {
      patchState(store, { graphic, confirmRequested: true, deleting: false });
    },
    setDeleting(deleting: boolean): void {
      patchState(store, { deleting });
    },
    reset(): void {
      patchState(store, initialState);
    },
  })),
);
