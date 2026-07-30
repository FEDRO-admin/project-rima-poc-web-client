import { computed, inject, Injectable, signal } from '@angular/core';
import { patchState, signalStore, signalStoreFeature, withComputed, withMethods, withState } from '@ngrx/signals';
import type Point from '@arcgis/core/geometry/Point';
import type FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import { ReferencePoint, ReferencePointType, AttributeValue } from './reference-point-types';
import type { AttributeEditField } from '../shared/attribute-edit-field';

// --- Per-type store (factory) ---
interface ReferencePointTypeState {
  points: ReferencePoint[];
  deletedObjectIds: number[];
  hiddenPointIds: string[];
  relationshipId: number | undefined;
  relatedLayer: FeatureLayer | undefined;
  fields: AttributeEditField[];
  displayVisible: boolean;
  loading: boolean;
}

const TYPE_INITIAL_STATE: ReferencePointTypeState = {
  points: [],
  deletedObjectIds: [],
  hiddenPointIds: [],
  relationshipId: undefined,
  relatedLayer: undefined,
  fields: [],
  displayVisible: true,
  loading: false,
};

const referencePointTypeFeature = signalStoreFeature(
  withState(TYPE_INITIAL_STATE),
  withComputed((store) => ({
    available: computed(() => store.relationshipId() != null),
    hasPendingChanges: computed(
      () => store.points().some((p) => p.isNew || p.isModified) || store.deletedObjectIds().length > 0,
    ),
  })),
  withMethods((store) => ({
    setup(
      relationshipId: number | undefined,
      relatedLayer: FeatureLayer | undefined,
      fields: AttributeEditField[],
    ): void {
      patchState(store, { ...TYPE_INITIAL_STATE, relationshipId, relatedLayer, fields });
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
    setDisplayVisible(displayVisible: boolean): void {
      patchState(store, { displayVisible });
    },
    togglePointHidden(clientId: string): void {
      const hidden = store.hiddenPointIds();
      const updated = hidden.includes(clientId) ? hidden.filter((id) => id !== clientId) : [...hidden, clientId];
      patchState(store, { hiddenPointIds: updated });
    },
    reset(): void {
      patchState(store, TYPE_INITIAL_STATE);
    },
  })),
);

// --- Concrete per-type stores ---
export const VonPointTypeStore = signalStore({ providedIn: 'root' }, referencePointTypeFeature);
export const BisPointTypeStore = signalStore({ providedIn: 'root' }, referencePointTypeFeature);

type ReferencePointTypeStoreInstance = InstanceType<typeof VonPointTypeStore> | InstanceType<typeof BisPointTypeStore>;

// --- Parent store (composes per-type stores + shared state) ---
@Injectable({ providedIn: 'root' })
export class ReferencePointStore {
  readonly von: ReferencePointTypeStoreInstance = inject(VonPointTypeStore);
  readonly bis: ReferencePointTypeStoreInstance = inject(BisPointTypeStore);

  readonly saving = signal(false);
  readonly editingType = signal<ReferencePointType | undefined>(undefined);
  readonly activeEditId = signal<string | undefined>(undefined);
  readonly addingType = signal<ReferencePointType | undefined>(undefined);
  readonly addingGeometry = signal<Point | undefined>(undefined);
  readonly addingAttributes = signal<Record<string, AttributeValue>>({});
  readonly sketchActive = signal(false);

  readonly hasPendingChanges = computed(() => this.von.hasPendingChanges() || this.bis.hasPendingChanges());

  forType(type: ReferencePointType): ReferencePointTypeStoreInstance {
    switch (type) {
      case 'von':
        return this.von;
      case 'bis':
        return this.bis;
    }
  }

  startAdding(type: ReferencePointType): void {
    this.addingType.set(type);
    this.addingGeometry.set(undefined);
    this.addingAttributes.set({});
  }

  cancelAdding(): void {
    this.addingType.set(undefined);
    this.addingGeometry.set(undefined);
    this.addingAttributes.set({});
  }

  setActiveEdit(type: ReferencePointType, clientId: string | undefined): void {
    this.editingType.set(clientId != null ? type : undefined);
    this.activeEditId.set(clientId);
  }

  reset(): void {
    this.von.reset();
    this.bis.reset();
    this.saving.set(false);
    this.editingType.set(undefined);
    this.activeEditId.set(undefined);
    this.addingType.set(undefined);
    this.addingGeometry.set(undefined);
    this.addingAttributes.set({});
    this.sketchActive.set(false);
  }
}
