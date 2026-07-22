import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';

export type ViewMode = '2d' | '3d';

interface ViewState {
  mode: ViewMode;
}

const initialState: ViewState = {
  mode: '2d',
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
