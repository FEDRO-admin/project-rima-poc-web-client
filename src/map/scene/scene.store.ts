import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { LoadingState } from '../loading-state';

export type SceneMode = '2d' | '3d';

interface SceneState {
  mode: SceneMode;
  sceneLayersLoadState: LoadingState;
}

const initialState: SceneState = {
  mode: '2d',
  sceneLayersLoadState: undefined,
};

export const SceneStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withMethods((store) => ({
    setMode(mode: SceneMode): void {
      patchState(store, { mode });
    },
    setSceneLayersLoadState(sceneLayersLoadState: LoadingState): void {
      patchState(store, { sceneLayersLoadState });
    },
  })),
);
