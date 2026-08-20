import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import type Point from '@arcgis/core/geometry/Point';

interface DocumentGeometryState {
  placingActive: boolean;
  placedGeometry: Point | undefined;
}

const initialState: DocumentGeometryState = {
  placingActive: false,
  placedGeometry: undefined,
};

export const DocumentGeometryStore = signalStore(
  withState(initialState),
  withMethods((store) => ({
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
