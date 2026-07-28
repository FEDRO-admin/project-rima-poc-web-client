import { computed } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import type Point from '@arcgis/core/geometry/Point';
import { ReferencePoint, ReferencePointRelationshipInfo, AttributeValue } from '../reference-point-types';

interface VonPointState {
  points: ReferencePoint[];
  deletedObjectIds: number[];
  hiddenPointIndices: number[];
  relationship: ReferencePointRelationshipInfo | undefined;
  activeEditIndex: number | undefined;
  addingActive: boolean;
  addingGeometry: Point | undefined;
  addingAttributes: Record<string, AttributeValue>;
  sketchActive: boolean;
  displayVisible: boolean;
  loading: boolean;
  saving: boolean;
}

const initialState: VonPointState = {
  points: [],
  deletedObjectIds: [],
  hiddenPointIndices: [],
  relationship: undefined,
  activeEditIndex: undefined,
  addingActive: false,
  addingGeometry: undefined,
  addingAttributes: {},
  sketchActive: false,
  displayVisible: true,
  loading: false,
  saving: false,
};

export const VonPointStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed((store) => ({
    hasRelationship: computed(() => store.relationship() != null),
    isAdding: computed(() => store.addingActive()),
    hasPendingChanges: computed(
      () => store.points().some((p) => p.isNew || p.isModified) || store.deletedObjectIds().length > 0,
    ),
  })),
  withMethods((store) => ({
    initialize(relationship: ReferencePointRelationshipInfo | undefined): void {
      patchState(store, { ...initialState, relationship });
    },
    setLoading(loading: boolean): void {
      patchState(store, { loading });
    },
    setSaving(saving: boolean): void {
      patchState(store, { saving });
    },
    setPoints(points: ReferencePoint[]): void {
      patchState(store, { points });
    },
    addPoint(point: ReferencePoint): void {
      patchState(store, { points: [...store.points(), point] });
    },
    updatePoint(index: number, point: ReferencePoint): void {
      const points = [...store.points()];
      points[index] = point;
      patchState(store, { points });
    },
    removePoint(index: number): void {
      const points = [...store.points()];
      const removed = points.splice(index, 1)[0];
      const deletedObjectIds =
        removed && !removed.isNew && removed.objectId != null
          ? [...store.deletedObjectIds(), removed.objectId]
          : store.deletedObjectIds();
      patchState(store, { points, deletedObjectIds });
    },
    setActiveEdit(index: number | undefined): void {
      patchState(store, { activeEditIndex: index });
    },
    startAdding(): void {
      patchState(store, { addingActive: true, addingGeometry: undefined, addingAttributes: {} });
    },
    setAddingGeometry(geometry: Point): void {
      patchState(store, { addingGeometry: geometry });
    },
    updateAddingAttribute(fieldName: string, value: AttributeValue): void {
      patchState(store, { addingAttributes: { ...store.addingAttributes(), [fieldName]: value } });
    },
    cancelAdding(): void {
      patchState(store, { addingActive: false, addingGeometry: undefined, addingAttributes: {} });
    },
    setSketchActive(sketchActive: boolean): void {
      patchState(store, { sketchActive });
    },
    setDisplayVisible(displayVisible: boolean): void {
      patchState(store, { displayVisible });
    },
    togglePointHidden(index: number): void {
      const hidden = store.hiddenPointIndices();
      const updated = hidden.includes(index) ? hidden.filter((i) => i !== index) : [...hidden, index];
      patchState(store, { hiddenPointIndices: updated });
    },
    reset(): void {
      patchState(store, initialState);
    },
  })),
);
