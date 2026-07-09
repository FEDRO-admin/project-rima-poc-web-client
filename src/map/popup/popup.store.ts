import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import Graphic from '@arcgis/core/Graphic';
import { computed } from '@angular/core';

interface PopupState {
  graphics: Graphic[];
  selectedIndex: number | undefined;
  hoveredIndex: number | undefined;
  visible: boolean;
}

const initialState: PopupState = {
  graphics: [],
  selectedIndex: undefined,
  hoveredIndex: undefined,
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
    open(graphics: Graphic[]): void {
      if (graphics.length === 1) {
        patchState(store, { graphics, selectedIndex: 0, visible: true });
      } else {
        patchState(store, { graphics, selectedIndex: undefined, visible: true });
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
        visible: false,
      });
    },
    replaceSelectedGraphic(graphic: Graphic): void {
      const index = store.selectedIndex();
      if (index == null) return;
      const updated = [...store.graphics()];
      updated[index] = graphic;
      patchState(store, { graphics: updated });
    },
  })),
);
