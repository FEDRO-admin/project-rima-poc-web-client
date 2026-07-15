import { computed } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import type Graphic from '@arcgis/core/Graphic';
import { DocumentRecord } from './document-types';

export type DocumentLoadState = 'idle' | 'loading' | 'loaded' | 'error';

interface DocumentsState {
  graphic: Graphic | undefined;
  documents: DocumentRecord[];
  loadState: DocumentLoadState;
  error: string | undefined;
  uploading: boolean;
  deleting: boolean;
}

const initialState: DocumentsState = {
  graphic: undefined,
  documents: [],
  loadState: 'idle',
  error: undefined,
  uploading: false,
  deleting: false,
};

export const DocumentsStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed((store) => ({
    isLoading: computed(() => store.loadState() === 'loading'),
    hasError: computed(() => store.loadState() === 'error'),
    isEmpty: computed(() => store.loadState() === 'loaded' && store.documents().length === 0),
    isUploading: computed(() => store.uploading()),
    isDeleting: computed(() => store.deleting()),
  })),
  withMethods((store) => ({
    setGraphic(graphic: Graphic): void {
      patchState(store, { graphic });
    },
    setLoading(): void {
      patchState(store, { loadState: 'loading', error: undefined });
    },
    setDocuments(documents: DocumentRecord[]): void {
      patchState(store, { documents, loadState: 'loaded' });
    },
    setError(error: string): void {
      patchState(store, { loadState: 'error', error });
    },
    setUploading(uploading: boolean): void {
      patchState(store, { uploading });
    },
    setDeleting(deleting: boolean): void {
      patchState(store, { deleting });
    },
    addDocument(document: DocumentRecord): void {
      patchState(store, { documents: [...store.documents(), document] });
    },
    removeDocument(objectId: number): void {
      patchState(store, { documents: store.documents().filter((d) => d.objectId !== objectId) });
    },
    reset(): void {
      patchState(store, initialState);
    },
  })),
);
