import { computed } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';

export type ViewMode = 'map' | 'scene';
export type InteractionMode = 'idle' | 'editing' | 'creating' | 'deleting';

interface ViewState {
  mode: ViewMode;
  interactionMode: InteractionMode;
  historicDate: Date | null;
  sketchActive: boolean;
  saving: boolean;
  loadingKeys: string[];
}

const initialState: ViewState = {
  mode: 'map',
  interactionMode: 'idle',
  historicDate: null,
  sketchActive: false,
  saving: false,
  loadingKeys: [],
};

export const ViewStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed((store) => ({
    locked: computed(() => store.interactionMode() !== 'idle'),
    historic: computed(() => store.historicDate() != null),
    busy: computed(() => store.sketchActive() || store.saving()),
    loading: computed(() => store.loadingKeys().length > 0),
  })),
  withMethods((store) => ({
    setMode(mode: ViewMode): void {
      patchState(store, { mode });
    },
    setInteractionMode(interactionMode: InteractionMode): void {
      patchState(store, { interactionMode });
    },
    setHistoricDate(historicDate: Date | null): void {
      patchState(store, { historicDate });
    },
    setSketchActive(sketchActive: boolean): void {
      patchState(store, { sketchActive });
    },
    setSaving(saving: boolean): void {
      patchState(store, { saving });
    },
    startLoading(key: string): void {
      if (!store.loadingKeys().includes(key)) {
        patchState(store, { loadingKeys: [...store.loadingKeys(), key] });
      }
    },
    stopLoading(key: string): void {
      patchState(store, { loadingKeys: store.loadingKeys().filter((k) => k !== key) });
    },
  })),
);
