import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { LoadingState } from '../loading-state';
import { HistoryEntry } from './history-entry';

interface HistoryState {
  active: boolean;
  selectedDate: Date | null;
  momentsState: LoadingState;
  moments: HistoryEntry[];
  selectedMoment: HistoryEntry | null;
  errorMessage: string;
  confirmingDelete: HistoryEntry | null;
}

const initialState: HistoryState = {
  active: false,
  selectedDate: null,
  momentsState: undefined,
  moments: [],
  selectedMoment: null,
  errorMessage: '',
  confirmingDelete: null,
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
    setMomentsLoading(): void {
      patchState(store, { momentsState: 'loading' });
    },
    setMoments(moments: HistoryEntry[]): void {
      patchState(store, { moments, momentsState: 'loaded' });
    },
    setMomentsError(): void {
      patchState(store, { momentsState: 'error' });
    },
    setSelectedMoment(selectedMoment: HistoryEntry | null): void {
      patchState(store, { selectedMoment });
    },
    setErrorMessage(errorMessage: string): void {
      patchState(store, { errorMessage });
    },
    setConfirmingDelete(confirmingDelete: HistoryEntry | null): void {
      patchState(store, { confirmingDelete });
    },
    reset(): void {
      patchState(store, initialState);
    },
  })),
);
