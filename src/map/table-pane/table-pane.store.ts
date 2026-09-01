import { computed } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';

interface TablePaneState {
  layer: FeatureLayer | undefined;
  visible: boolean;
}

const initialState: TablePaneState = {
  layer: undefined,
  visible: false,
};

export const TablePaneStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed((store) => ({
    title: computed(() => store.layer()?.title ?? ''),
  })),
  withMethods((store) => ({
    open(layer: FeatureLayer): void {
      patchState(store, { layer, visible: true });
    },
    close(): void {
      patchState(store, { layer: undefined, visible: false });
    },
  })),
);
