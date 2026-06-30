import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { computed } from '@angular/core';
import type Graphic from '@arcgis/core/Graphic';
import { HierarchyNode } from './hierarchy-node';

export type HierarchyLoadState = 'idle' | 'loading' | 'loaded' | 'error';

interface HierarchyState {
  graphic: Graphic | undefined;
  tree: HierarchyNode | undefined;
  loadState: HierarchyLoadState;
  error: string | undefined;
}

const initialState: HierarchyState = {
  graphic: undefined,
  tree: undefined,
  loadState: 'idle',
  error: undefined,
};

export const HierarchyStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed((store) => ({
    isLoading: computed(() => store.loadState() === 'loading'),
    hasError: computed(() => store.loadState() === 'error'),
    isEmpty: computed(() => store.loadState() === 'loaded' && !store.tree()),
  })),
  withMethods((store) => ({
    setGraphic(graphic: Graphic): void {
      patchState(store, { graphic });
    },
    setLoading(): void {
      patchState(store, { loadState: 'loading', error: undefined, tree: undefined });
    },
    setTree(tree: HierarchyNode): void {
      patchState(store, { tree, loadState: 'loaded' });
    },
    setError(error: string): void {
      patchState(store, { loadState: 'error', error });
    },
    reset(): void {
      patchState(store, initialState);
    },
  })),
);
