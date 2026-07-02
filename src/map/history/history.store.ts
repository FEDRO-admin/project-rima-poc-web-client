import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import type TimeExtent from '@arcgis/core/time/TimeExtent';

interface HistoryState {
  active: boolean;
  fullTimeExtent: TimeExtent | null;
}

const initialState: HistoryState = {
  active: false,
  fullTimeExtent: null,
};

export const HistoryStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withMethods((store) => ({
    activate(): void {
      patchState(store, { active: true });
    },
    deactivate(): void {
      patchState(store, { active: false });
    },
    toggle(): void {
      patchState(store, { active: !store.active() });
    },
    setFullTimeExtent(fullTimeExtent: TimeExtent): void {
      patchState(store, { fullTimeExtent });
    },
    reset(): void {
      patchState(store, initialState);
    },
  })),
);
