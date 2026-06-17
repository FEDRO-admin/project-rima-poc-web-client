import { computed } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import Graphic from '@arcgis/core/Graphic';
import type Geometry from '@arcgis/core/geometry/Geometry';

type AttributeValue = string | number | boolean | null;

interface EditState {
  graphic: Graphic | undefined;
  originalAttributes: Record<string, AttributeValue>;
  editedAttributes: Record<string, AttributeValue>;
  saving: boolean;
  allowsGeometryEditing: boolean;
  editedGeometry: Geometry | undefined;
}

const initialState: EditState = {
  graphic: undefined,
  originalAttributes: {},
  editedAttributes: {},
  saving: false,
  allowsGeometryEditing: false,
  editedGeometry: undefined,
};

export const EditStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed((store) => ({
    editing: computed(() => store.graphic() != null),
    isDirty: computed(() => {
      const original: Record<string, AttributeValue> = store.originalAttributes();
      const edited: Record<string, AttributeValue> = store.editedAttributes();
      const hasAttributeChanges: boolean = Object.keys(edited).some((key) => edited[key] !== original[key]);
      const hasGeometryChanges: boolean = store.editedGeometry() != null;
      return hasAttributeChanges || hasGeometryChanges;
    }),
  })),
  withMethods((store) => ({
    startEditing(graphic: Graphic): void {
      const attrs: Record<string, AttributeValue> = { ...(graphic.attributes ?? {}) };
      patchState(store, {
        graphic,
        originalAttributes: attrs,
        editedAttributes: { ...attrs },
        saving: false,
        allowsGeometryEditing: false,
        editedGeometry: undefined,
      });
    },
    updateField(fieldName: string, value: AttributeValue): void {
      const edited = { ...store.editedAttributes(), [fieldName]: value };
      patchState(store, { editedAttributes: edited });
    },
    enableGeometryEditing(): void {
      patchState(store, { allowsGeometryEditing: true });
    },
    disableGeometryEditing(): void {
      patchState(store, { allowsGeometryEditing: false });
    },
    updateGeometry(geometry: Geometry): void {
      patchState(store, { editedGeometry: geometry });
    },
    setSaving(saving: boolean): void {
      patchState(store, { saving });
    },
    reset(): void {
      patchState(store, initialState);
    },
  })),
);
