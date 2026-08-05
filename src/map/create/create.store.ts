import { computed } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import type FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import type Geometry from '@arcgis/core/geometry/Geometry';
import { resolveCreatableFields, buildDefaultAttributes } from './create-attribute.service';

type AttributeValue = string | number | boolean | null;

interface CreateState {
  active: boolean;
  layer: FeatureLayer | undefined;
  attributes: Record<string, AttributeValue>;
  geometry: Geometry | undefined;
  adjusting: boolean;
  canUndo: boolean;
  canRedo: boolean;
}

const initialState: CreateState = {
  active: false,
  layer: undefined,
  attributes: {},
  geometry: undefined,
  adjusting: false,
  canUndo: false,
  canRedo: false,
};

export const CreateStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed((store) => ({
    isDirty: computed(() => {
      const hasAttributes = Object.values(store.attributes()).some((v) => v != null && v !== '');
      const hasGeometry = store.geometry() != null;
      return hasAttributes || hasGeometry;
    }),
  })),
  withMethods((store) => ({
    activate(layer: FeatureLayer): void {
      const fields = resolveCreatableFields(layer);
      const attributes = buildDefaultAttributes(layer, fields);
      patchState(store, {
        active: true,
        layer,
        attributes,
        geometry: undefined,
        adjusting: false,
        canUndo: false,
        canRedo: false,
      });
    },
    open(): void {
      patchState(store, { active: true });
    },
    setLayer(layer: FeatureLayer): void {
      patchState(store, {
        layer,
        attributes: {},
        geometry: undefined,
        adjusting: false,
        canUndo: false,
        canRedo: false,
      });
    },
    updateField(fieldName: string, value: AttributeValue): void {
      const attributes = { ...store.attributes(), [fieldName]: value };
      patchState(store, { attributes });
    },
    setAttributes(attributes: Record<string, AttributeValue>): void {
      patchState(store, { attributes });
    },
    updateGeometry(geometry: Geometry): void {
      patchState(store, { geometry });
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
