import { computed } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import type Point from '@arcgis/core/geometry/Point';
import { ReferencePoint, ReferencePointRelationshipInfo, AttributeValue } from '../reference-point-types';

interface BisPointState {
  points: ReferencePoint[];
  deletedObjectIds: number[];
  hiddenPointIds: string[];
  relationship: ReferencePointRelationshipInfo | undefined;
  activeEditId: string | undefined;
  addingActive: boolean;
  addingGeometry: Point | undefined;
  addingAttributes: Record<string, AttributeValue>;
  sketchActive: boolean;
  displayVisible: boolean;
  loading: boolean;
  saving: boolean;
}

const initialState: BisPointState = {
  points: [],
  deletedObjectIds: [],
  hiddenPointIds: [],
  relationship: undefined,
  activeEditId: undefined,
  addingActive: false,
  addingGeometry: undefined,
  addingAttributes: {},
  sketchActive: false,
  displayVisible: true,
  loading: false,
  saving: false,
};

export const BisPointStore = signalStore(
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
    updatePoint(clientId: string, updates: Partial<ReferencePoint>): void {
      const points = store.points().map((p) => (p.clientId === clientId ? { ...p, ...updates } : p));
      patchState(store, { points });
    },
    removePoint(clientId: string): void {
      const point = store.points().find((p) => p.clientId === clientId);
      const points = store.points().filter((p) => p.clientId !== clientId);
      const deletedObjectIds =
        point && !point.isNew && point.objectId != null
          ? [...store.deletedObjectIds(), point.objectId]
          : store.deletedObjectIds();
      const hiddenPointIds = store.hiddenPointIds().filter((id) => id !== clientId);
      patchState(store, { points, deletedObjectIds, hiddenPointIds });
    },
    setActiveEdit(clientId: string | undefined): void {
      patchState(store, { activeEditId: clientId });
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
    togglePointHidden(clientId: string): void {
      const hidden = store.hiddenPointIds();
      const updated = hidden.includes(clientId) ? hidden.filter((id) => id !== clientId) : [...hidden, clientId];
      patchState(store, { hiddenPointIds: updated });
    },
    reset(): void {
      patchState(store, initialState);
    },
  })),
);
