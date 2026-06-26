import { computed } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import type FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import type Geometry from '@arcgis/core/geometry/Geometry';
import { resolveCreatableFields, buildDefaultAttributes } from './create-attribute.service';

type AttributeValue = string | number | boolean | null;

interface CreateState {
  active: boolean;
  layer: FeatureLayer | undefined;
  subtypeField: string | undefined;
  subtypeValue: number | string | undefined;
  attributes: Record<string, AttributeValue>;
  geometry: Geometry | undefined;
  sketchActive: boolean;
  adjusting: boolean;
  saving: boolean;
  canUndo: boolean;
  canRedo: boolean;
}

const initialState: CreateState = {
  active: false,
  layer: undefined,
  subtypeField: undefined,
  subtypeValue: undefined,
  attributes: {},
  geometry: undefined,
  sketchActive: false,
  adjusting: false,
  saving: false,
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
    activate(layer: FeatureLayer, subtypeField?: string, subtypeValue?: number | string): void {
      const fields = resolveCreatableFields(layer, subtypeValue);
      const attributes = buildDefaultAttributes(layer, fields);
      patchState(store, {
        active: true,
        layer,
        subtypeField,
        subtypeValue,
        attributes,
        geometry: undefined,
        sketchActive: false,
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
        subtypeField: undefined,
        subtypeValue: undefined,
        attributes: {},
        geometry: undefined,
        sketchActive: false,
        adjusting: false,
        canUndo: false,
        canRedo: false,
      });
    },
    setSubtype(subtypeField: string, subtypeValue: number | string): void {
      patchState(store, { subtypeField, subtypeValue });
    },
    changeSubtype(subtypeValue: number | string): void {
      const layer = store.layer();
      if (!layer) return;
      const fields = resolveCreatableFields(layer, subtypeValue);
      const attributes = buildDefaultAttributes(layer, fields);
      patchState(store, { subtypeValue, attributes });
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
    setSketchActive(sketchActive: boolean): void {
      patchState(store, { sketchActive });
    },
    setAdjusting(adjusting: boolean): void {
      patchState(store, { adjusting });
    },
    setSaving(saving: boolean): void {
      patchState(store, { saving });
    },
    setUndoRedo(canUndo: boolean, canRedo: boolean): void {
      patchState(store, { canUndo, canRedo });
    },
    deactivateSketch(): void {
      patchState(store, { sketchActive: false, adjusting: false, canUndo: false, canRedo: false });
    },
    reset(): void {
      patchState(store, initialState);
    },
  })),
);
