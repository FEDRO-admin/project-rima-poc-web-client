import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';

export type ViewMode = 'map' | 'scene';

interface ViewState {
  mode: ViewMode;
}

const initialState: ViewState = {
  mode: 'map',
};

export const ViewStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withMethods((store) => ({
    setMode(mode: ViewMode): void {
      patchState(store, { mode });
    },
  })),
);
