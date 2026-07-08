import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';

interface HistoryState {
  active: boolean;
  selectedDate: Date | null;
}

const initialState: HistoryState = {
  active: false,
  selectedDate: null,
};

export const HistoryStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withMethods((store) => ({
    activate(date: Date): void {
      patchState(store, { active: true, selectedDate: date });
    },
    deactivate(): void {
      patchState(store, { active: false, selectedDate: null });
    },
    toggle(): void {
      patchState(store, { active: !store.active() });
    },
    reset(): void {
      patchState(store, initialState);
    },
  })),
);
