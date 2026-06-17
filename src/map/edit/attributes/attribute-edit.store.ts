import { computed } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import Graphic from '@arcgis/core/Graphic';

type AttributeValue = string | number | boolean | null;

interface EditState {
  graphic: Graphic | undefined;
  originalAttributes: Record<string, AttributeValue>;
  editedAttributes: Record<string, AttributeValue>;
  saving: boolean;
}

const initialState: EditState = {
  graphic: undefined,
  originalAttributes: {},
  editedAttributes: {},
  saving: false,
};

export const AttributeEditStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed((store) => ({
    editing: computed(() => store.graphic() != null),
    isDirty: computed(() => {
      const original: Record<string, AttributeValue> = store.originalAttributes();
      const edited: Record<string, AttributeValue> = store.editedAttributes();
      return Object.keys(edited).some((key) => edited[key] !== original[key]);
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
      });
    },
    updateField(fieldName: string, value: AttributeValue): void {
      const edited = { ...store.editedAttributes(), [fieldName]: value };
      patchState(store, { editedAttributes: edited });
    },
    setSaving(saving: boolean): void {
      patchState(store, { saving });
    },
    reset(): void {
      patchState(store, initialState);
    },
  })),
);
