import { computed } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import Graphic from '@arcgis/core/Graphic';
import type FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import type Geometry from '@arcgis/core/geometry/Geometry';
import { resolveCreatableFields, buildDefaultAttributes } from './attribute-field-utils';

type AttributeValue = string | number | boolean | null;
export type AttributeEditMode = 'edit' | 'create';

interface AttributeEditState {
  mode: AttributeEditMode | undefined;
  graphic: Graphic | undefined;
  layer: FeatureLayer | undefined;
  originalAttributes: Record<string, AttributeValue>;
  editedAttributes: Record<string, AttributeValue>;
  editedGeometry: Geometry | undefined;
  adjusting: boolean;
  canUndo: boolean;
  canRedo: boolean;
}

const initialState: AttributeEditState = {
  mode: undefined,
  graphic: undefined,
  layer: undefined,
  originalAttributes: {},
  editedAttributes: {},
  editedGeometry: undefined,
  adjusting: false,
  canUndo: false,
  canRedo: false,
};

export const AttributeEditStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed((store) => ({
    active: computed(() => store.mode() != null),
    isEditing: computed(() => store.mode() === 'edit'),
    isCreating: computed(() => store.mode() === 'create'),
    isAttributesDirty: computed(() => {
      const original = store.originalAttributes();
      const edited = store.editedAttributes();
      return Object.keys(edited).some((key) => edited[key] !== original[key]);
    }),
    isGeometryDirty: computed(() => store.editedGeometry() != null),
    isDirty: computed(() => {
      if (store.mode() === 'create') {
        const hasAttributes = Object.values(store.editedAttributes()).some((v) => v != null && v !== '');
        return hasAttributes || store.editedGeometry() != null;
      }
      const original = store.originalAttributes();
      const edited = store.editedAttributes();
      const attrDirty = Object.keys(edited).some((key) => edited[key] !== original[key]);
      return attrDirty || store.editedGeometry() != null;
    }),
  })),
  withMethods((store) => ({
    activateEdit(graphic: Graphic): void {
      const attrs: Record<string, AttributeValue> = { ...(graphic.attributes ?? {}) };
      patchState(store, {
        mode: 'edit',
        graphic,
        layer: undefined,
        originalAttributes: attrs,
        editedAttributes: { ...attrs },
        editedGeometry: undefined,
        adjusting: false,
        canUndo: false,
        canRedo: false,
      });
    },
    activateCreate(layer: FeatureLayer): void {
      const fields = resolveCreatableFields(layer);
      const attributes = buildDefaultAttributes(layer, fields);
      patchState(store, {
        mode: 'create',
        graphic: undefined,
        layer,
        originalAttributes: {},
        editedAttributes: attributes,
        editedGeometry: undefined,
        adjusting: false,
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
    setAdjusting(adjusting: boolean): void {
      patchState(store, { adjusting });
    },
    setUndoRedo(canUndo: boolean, canRedo: boolean): void {
      patchState(store, { canUndo, canRedo });
    },
    deactivateSketch(): void {
      patchState(store, { adjusting: false, canUndo: false, canRedo: false });
    },
    reset(): void {
      patchState(store, initialState);
    },
  })),
);
