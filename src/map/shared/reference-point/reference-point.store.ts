import { computed } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import type Point from '@arcgis/core/geometry/Point';
import {
  ReferencePoint,
  ReferencePointRelationshipInfo,
  ReferencePointType,
  AttributeValue,
} from './reference-point-types';

interface ReferencePointState {
  vonPoints: ReferencePoint[];
  bisPoints: ReferencePoint[];
  deletedVonObjectIds: number[];
  deletedBisObjectIds: number[];
  vonRelationship: ReferencePointRelationshipInfo | undefined;
  bisRelationship: ReferencePointRelationshipInfo | undefined;
  activeEdit: { type: ReferencePointType; index: number } | undefined;
  addingType: ReferencePointType | undefined;
  addingGeometry: Point | undefined;
  addingAttributes: Record<string, AttributeValue>;
  sketchActive: boolean;
  loading: boolean;
  saving: boolean;
}

const initialState: ReferencePointState = {
  vonPoints: [],
  bisPoints: [],
  deletedVonObjectIds: [],
  deletedBisObjectIds: [],
  vonRelationship: undefined,
  bisRelationship: undefined,
  activeEdit: undefined,
  addingType: undefined,
  addingGeometry: undefined,
  addingAttributes: {},
  sketchActive: false,
  loading: false,
  saving: false,
};

export const ReferencePointStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed((store) => ({
    hasRelationships: computed(() => store.vonRelationship() != null || store.bisRelationship() != null),
    vonCount: computed(() => store.vonPoints().length),
    bisCount: computed(() => store.bisPoints().length),
    isAdding: computed(() => store.addingType() != null),
    hasPendingChanges: computed(() => {
      const hasNewVon = store.vonPoints().some((p) => p.isNew);
      const hasNewBis = store.bisPoints().some((p) => p.isNew);
      const hasModifiedVon = store.vonPoints().some((p) => p.isModified);
      const hasModifiedBis = store.bisPoints().some((p) => p.isModified);
      const hasDeletedVon = store.deletedVonObjectIds().length > 0;
      const hasDeletedBis = store.deletedBisObjectIds().length > 0;
      return hasNewVon || hasNewBis || hasModifiedVon || hasModifiedBis || hasDeletedVon || hasDeletedBis;
    }),
  })),
  withMethods((store) => ({
    initialize(
      vonRel: ReferencePointRelationshipInfo | undefined,
      bisRel: ReferencePointRelationshipInfo | undefined,
    ): void {
      patchState(store, {
        vonRelationship: vonRel,
        bisRelationship: bisRel,
        vonPoints: [],
        bisPoints: [],
        deletedVonObjectIds: [],
        deletedBisObjectIds: [],
        activeEdit: undefined,
        addingType: undefined,
        addingGeometry: undefined,
        addingAttributes: {},
        sketchActive: false,
        loading: false,
        saving: false,
      });
    },
    setLoading(loading: boolean): void {
      patchState(store, { loading });
    },
    setSaving(saving: boolean): void {
      patchState(store, { saving });
    },
    setPoints(type: ReferencePointType, points: ReferencePoint[]): void {
      if (type === 'von') {
        patchState(store, { vonPoints: points });
      } else {
        patchState(store, { bisPoints: points });
      }
    },
    addPoint(type: ReferencePointType, point: ReferencePoint): void {
      if (type === 'von') {
        patchState(store, { vonPoints: [...store.vonPoints(), point] });
      } else {
        patchState(store, { bisPoints: [...store.bisPoints(), point] });
      }
    },
    updatePoint(type: ReferencePointType, index: number, point: ReferencePoint): void {
      if (type === 'von') {
        const updated = [...store.vonPoints()];
        updated[index] = point;
        patchState(store, { vonPoints: updated });
      } else {
        const updated = [...store.bisPoints()];
        updated[index] = point;
        patchState(store, { bisPoints: updated });
      }
    },
    removePoint(type: ReferencePointType, index: number): void {
      if (type === 'von') {
        const points = [...store.vonPoints()];
        const removed = points.splice(index, 1)[0];
        patchState(store, { vonPoints: points });
        if (removed && !removed.isNew && removed.objectId != null) {
          patchState(store, { deletedVonObjectIds: [...store.deletedVonObjectIds(), removed.objectId] });
        }
      } else {
        const points = [...store.bisPoints()];
        const removed = points.splice(index, 1)[0];
        patchState(store, { bisPoints: points });
        if (removed && !removed.isNew && removed.objectId != null) {
          patchState(store, { deletedBisObjectIds: [...store.deletedBisObjectIds(), removed.objectId] });
        }
      }
    },
    setActiveEdit(type: ReferencePointType, index: number): void {
      patchState(store, { activeEdit: { type, index } });
    },
    clearActiveEdit(): void {
      patchState(store, { activeEdit: undefined });
    },
    startAdding(type: ReferencePointType): void {
      patchState(store, { addingType: type, addingGeometry: undefined, addingAttributes: {} });
    },
    setAddingGeometry(geometry: Point): void {
      patchState(store, { addingGeometry: geometry });
    },
    updateAddingAttribute(fieldName: string, value: AttributeValue): void {
      const attributes = { ...store.addingAttributes(), [fieldName]: value };
      patchState(store, { addingAttributes: attributes });
    },
    cancelAdding(): void {
      patchState(store, { addingType: undefined, addingGeometry: undefined, addingAttributes: {} });
    },
    setSketchActive(sketchActive: boolean): void {
      patchState(store, { sketchActive });
    },
    reset(): void {
      patchState(store, initialState);
    },
  })),
);
