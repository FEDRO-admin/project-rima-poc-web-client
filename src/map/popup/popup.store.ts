import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import Graphic from '@arcgis/core/Graphic';
import Point from '@arcgis/core/geometry/Point';
import { computed } from '@angular/core';

export interface ScreenPoint {
  x: number;
  y: number;
}

interface PopupState {
  graphics: Graphic[];
  selectedIndex: number | undefined;
  hoveredIndex: number | undefined;
  screenPoint: ScreenPoint | undefined;
  anchorMapPoint: Point | undefined;
  docked: boolean;
  visible: boolean;
}

const initialState: PopupState = {
  graphics: [],
  selectedIndex: undefined,
  hoveredIndex: undefined,
  screenPoint: undefined,
  anchorMapPoint: undefined,
  docked: false,
  visible: false,
};

export const PopupStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed((store) => ({
    selectedGraphic: computed(() => {
      const index = store.selectedIndex();
      return index != null ? store.graphics()[index] : undefined;
    }),
    showList: computed(() => store.visible() && store.selectedIndex() == null),
    showDetail: computed(() => store.visible() && store.selectedIndex() != null),
  })),
  withMethods((store) => ({
    open(graphics: Graphic[], screenPoint: ScreenPoint, mapPoint: Point): void {
      if (graphics.length === 1) {
        patchState(store, { graphics, selectedIndex: 0, screenPoint, anchorMapPoint: mapPoint, visible: true });
      } else {
        patchState(store, { graphics, selectedIndex: undefined, screenPoint, anchorMapPoint: mapPoint, visible: true });
      }
    },
    selectFeature(index: number): void {
      patchState(store, { selectedIndex: index, hoveredIndex: undefined });
    },
    backToList(): void {
      patchState(store, { selectedIndex: undefined });
    },
    hoverFeature(index: number | undefined): void {
      patchState(store, { hoveredIndex: index });
    },
    close(): void {
      patchState(store, {
        graphics: [],
        selectedIndex: undefined,
        hoveredIndex: undefined,
        screenPoint: undefined,
        anchorMapPoint: undefined,
        docked: false,
        visible: false,
      });
    },
    updatePosition(screenPoint: ScreenPoint): void {
      patchState(store, { screenPoint });
    },
    updateAnchor(screenPoint: ScreenPoint, mapPoint: Point): void {
      patchState(store, { screenPoint, anchorMapPoint: mapPoint });
    },
    toggleDocked(): void {
      patchState(store, { docked: !store.docked() });
    },
  })),
);
