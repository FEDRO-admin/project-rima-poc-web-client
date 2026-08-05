import { computed } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import Graphic from '@arcgis/core/Graphic';
import type Geometry from '@arcgis/core/geometry/Geometry';

type AttributeValue = string | number | boolean | null;

interface EditState {
  graphic: Graphic | undefined;
  originalAttributes: Record<string, AttributeValue>;
  editedAttributes: Record<string, AttributeValue>;
  editedGeometry: Geometry | undefined;
  canUndo: boolean;
  canRedo: boolean;
}

const initialState: EditState = {
  graphic: undefined,
  originalAttributes: {},
  editedAttributes: {},
  editedGeometry: undefined,
  canUndo: false,
  canRedo: false,
};

export const EditStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed((store) => ({
    active: computed(() => store.graphic() != null),
    isAttributesDirty: computed(() => {
      const original = store.originalAttributes();
      const edited = store.editedAttributes();
      return Object.keys(edited).some((key) => edited[key] !== original[key]);
    }),
    isGeometryDirty: computed(() => store.editedGeometry() != null),
    isDirty: computed(() => {
      const original = store.originalAttributes();
      const edited = store.editedAttributes();
      const attrDirty = Object.keys(edited).some((key) => edited[key] !== original[key]);
      const geoDirty = store.editedGeometry() != null;
      return attrDirty || geoDirty;
    }),
  })),
  withMethods((store) => ({
    activate(graphic: Graphic): void {
      const attrs: Record<string, AttributeValue> = { ...(graphic.attributes ?? {}) };
      patchState(store, {
        graphic,
        originalAttributes: attrs,
        editedAttributes: { ...attrs },
        editedGeometry: undefined,
        canUndo: false,
        canRedo: false,
      });
    },
    updateField(fieldName: string, value: AttributeValue): void {
      const edited = { ...store.editedAttributes(), [fieldName]: value };
      patchState(store, { editedAttributes: edited });
    },
    updateGeometry(geometry: Geometry): void {
      patchState(store, { editedGeometry: geometry });
    },
    clearGeometry(): void {
      patchState(store, { editedGeometry: undefined });
    },
    setUndoRedo(canUndo: boolean, canRedo: boolean): void {
      patchState(store, { canUndo, canRedo });
    },
    deactivateSketch(): void {
      patchState(store, { canUndo: false, canRedo: false });
    },
    reset(): void {
      patchState(store, initialState);
    },
  })),
);
