import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import type Point from '@arcgis/core/geometry/Point';

interface PointPlacementState {
  placingActive: boolean;
  placedGeometry: Point | undefined;
}

const initialState: PointPlacementState = {
  placingActive: false,
  placedGeometry: undefined,
};

export const PointPlacementStore = signalStore(
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
