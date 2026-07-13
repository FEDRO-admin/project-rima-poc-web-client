import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';

export type SceneMode = '2d' | '3d';

interface SceneState {
  mode: SceneMode;
}

const initialState: SceneState = {
  mode: '2d',
};

export const SceneStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withMethods((store) => ({
    setMode(mode: SceneMode): void {
      patchState(store, { mode });
    },
  })),
);
