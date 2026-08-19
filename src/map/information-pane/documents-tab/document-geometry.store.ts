import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import type Point from '@arcgis/core/geometry/Point';

interface DocumentGeometryState {
  displayVisible: boolean;
  hiddenDocumentIds: number[];
  placingActive: boolean;
  placedGeometry: Point | undefined;
}

const initialState: DocumentGeometryState = {
  displayVisible: true,
  hiddenDocumentIds: [],
  placingActive: false,
  placedGeometry: undefined,
};

export const DocumentGeometryStore = signalStore(
  withState(initialState),
  withMethods((store) => ({
    setDisplayVisible(displayVisible: boolean): void {
      patchState(store, { displayVisible });
    },
    toggleDocumentHidden(objectId: number): void {
      const ids = store.hiddenDocumentIds();
      const updated = ids.includes(objectId) ? ids.filter((id) => id !== objectId) : [...ids, objectId];
      patchState(store, { hiddenDocumentIds: updated });
    },
    setPlacingActive(placingActive: boolean): void {
      patchState(store, { placingActive });
    },
    setPlacedGeometry(placedGeometry: Point | undefined): void {
      patchState(store, { placedGeometry, placingActive: false });
    },
    reset(): void {
      patchState(store, initialState);
    },
  })),
);
