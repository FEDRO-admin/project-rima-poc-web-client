import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { LoadingState } from '../loading-state';
import { HistoricMomentEntry } from './history-config';

interface HistoryState {
  active: boolean;
  selectedDate: Date | null;
  momentsState: LoadingState;
  moments: HistoricMomentEntry[];
  selectedMoment: HistoricMomentEntry | null;
  panelExpanded: boolean;
  customExpanded: boolean;
  customDate: string;
  customTime: string;
  addFormVisible: boolean;
  newName: string;
  newDate: string;
  newTime: string;
  errorMessage: string;
  confirmingDelete: HistoricMomentEntry | null;
}

const initialState: HistoryState = {
  active: false,
  selectedDate: null,
  momentsState: undefined,
  moments: [],
  selectedMoment: null,
  panelExpanded: false,
  customExpanded: false,
  customDate: '',
  customTime: '',
  addFormVisible: false,
  newName: '',
  newDate: '',
  newTime: '',
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
    setMoments(moments: HistoricMomentEntry[]): void {
      patchState(store, { moments, momentsState: 'loaded' });
    },
    setMomentsError(): void {
      patchState(store, { momentsState: 'error' });
    },
    setSelectedMoment(selectedMoment: HistoricMomentEntry | null): void {
      patchState(store, { selectedMoment });
    },
    setPanelExpanded(panelExpanded: boolean): void {
      patchState(store, { panelExpanded });
    },
    setCustomExpanded(customExpanded: boolean): void {
      patchState(store, { customExpanded });
    },
    setCustomDate(customDate: string): void {
      patchState(store, { customDate });
    },
    setCustomTime(customTime: string): void {
      patchState(store, { customTime });
    },
    setAddFormVisible(addFormVisible: boolean): void {
      patchState(store, { addFormVisible });
    },
    setNewName(newName: string): void {
      patchState(store, { newName });
    },
    setNewDate(newDate: string): void {
      patchState(store, { newDate });
    },
    setNewTime(newTime: string): void {
      patchState(store, { newTime });
    },
    setErrorMessage(errorMessage: string): void {
      patchState(store, { errorMessage });
    },
    setConfirmingDelete(confirmingDelete: HistoricMomentEntry | null): void {
      patchState(store, { confirmingDelete });
    },
    reset(): void {
      patchState(store, initialState);
    },
  })),
);
