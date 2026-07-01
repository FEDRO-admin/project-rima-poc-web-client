import { computed } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import type Geometry from '@arcgis/core/geometry/Geometry';

interface GeometryEditState {
  editing: boolean;
  sketchActive: boolean;
  editedGeometry: Geometry | undefined;
  saving: boolean;
  canUndo: boolean;
  canRedo: boolean;
}

const initialState: GeometryEditState = {
  editing: false,
  sketchActive: false,
  editedGeometry: undefined,
  saving: false,
  canUndo: false,
  canRedo: false,
};

export const GeometryEditStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed((store) => ({
    isDirty: computed(() => store.editedGeometry() != null),
  })),
  withMethods((store) => ({
    setEditing(editing: boolean): void {
      patchState(store, { editing });
    },
    setSketchActive(sketchActive: boolean): void {
      patchState(store, { sketchActive });
    },
    updateGeometry(geometry: Geometry): void {
      patchState(store, { editedGeometry: geometry });
    },
    setSaving(saving: boolean): void {
      patchState(store, { saving });
    },
    setUndoRedo(canUndo: boolean, canRedo: boolean): void {
      patchState(store, { canUndo, canRedo });
    },
    deactivateSketch(): void {
      patchState(store, { sketchActive: false, canUndo: false, canRedo: false });
    },
    reset(): void {
      patchState(store, initialState);
    },
  })),
);
