import { computed } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import type Point from '@arcgis/core/geometry/Point';
import type FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import { ReferencePoint, AttributeValue } from './reference-point-types';
import { AttributeEditField } from '../../../shared/attribute-edit-field';

interface ReferencePointComponentState {
  points: ReferencePoint[];
  deletedObjectIds: number[];
  hiddenPointIds: string[];
  highlightedIds: string[];
  relationshipId: number | undefined;
  relatedLayer: FeatureLayer | undefined;
  fields: AttributeEditField[];
  displayVisible: boolean;
  loading: boolean;
  activeEditId: string | undefined;
  addingActive: boolean;
  addingGeometry: Point | undefined;
  addingAttributes: Record<string, AttributeValue>;
}

const initialState: ReferencePointComponentState = {
  points: [],
  deletedObjectIds: [],
  hiddenPointIds: [],
  highlightedIds: [],
  relationshipId: undefined,
  relatedLayer: undefined,
  fields: [],
  displayVisible: true,
  loading: false,
  activeEditId: undefined,
  addingActive: false,
  addingGeometry: undefined,
  addingAttributes: {},
};

export const ReferencePointComponentStore = signalStore(
  withState(initialState),
  withComputed((store) => ({
    available: computed(() => store.relationshipId() != null),
    hasPendingChanges: computed(
      () => store.points().some((p) => p.isNew || p.isModified) || store.deletedObjectIds().length > 0,
    ),
    isAdding: computed(() => store.addingActive()),
  })),
  withMethods((store) => ({
    setup(
      relationshipId: number | undefined,
      relatedLayer: FeatureLayer | undefined,
      fields: AttributeEditField[],
    ): void {
      patchState(store, { ...initialState, relationshipId, relatedLayer, fields });
    },
    setLoading(loading: boolean): void {
      patchState(store, { loading });
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
      const attributes = { ...store.addingAttributes(), [fieldName]: value };
      patchState(store, { addingAttributes: attributes });
    },
    cancelAdding(): void {
      patchState(store, { addingActive: false, addingGeometry: undefined, addingAttributes: {} });
    },
    setDisplayVisible(displayVisible: boolean): void {
      patchState(store, { displayVisible });
    },
    togglePointHidden(clientId: string): void {
      const hidden = store.hiddenPointIds();
      const updated = hidden.includes(clientId) ? hidden.filter((id) => id !== clientId) : [...hidden, clientId];
      patchState(store, { hiddenPointIds: updated });
    },
    setHighlightedIds(highlightedIds: string[]): void {
      patchState(store, { highlightedIds });
    },
    markSaved(): void {
      const points = store.points().map((p) => ({ ...p, isNew: false, isModified: false }));
      patchState(store, { points, deletedObjectIds: [] });
    },
    reset(): void {
      patchState(store, initialState);
    },
  })),
);
