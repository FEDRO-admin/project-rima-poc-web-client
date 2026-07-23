import { computed } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import type Point from '@arcgis/core/geometry/Point';
import {
  INITIAL_POINT_TYPE_STATE,
  PointTypeState,
  ReferencePoint,
  ReferencePointRelationshipInfo,
  ReferencePointType,
  AttributeValue,
} from './reference-point-types';

interface ReferencePointState {
  von: PointTypeState;
  bis: PointTypeState;
  activeEdit: { type: ReferencePointType; index: number } | undefined;
  addingType: ReferencePointType | undefined;
  addingGeometry: Point | undefined;
  addingAttributes: Record<string, AttributeValue>;
  sketchActive: boolean;
  loading: boolean;
  saving: boolean;
}

const initialState: ReferencePointState = {
  von: INITIAL_POINT_TYPE_STATE,
  bis: INITIAL_POINT_TYPE_STATE,
  activeEdit: undefined,
  addingType: undefined,
  addingGeometry: undefined,
  addingAttributes: {},
  sketchActive: false,
  loading: false,
  saving: false,
};

function getGroup(
  store: { von: () => PointTypeState; bis: () => PointTypeState },
  type: ReferencePointType,
): PointTypeState {
  return type === 'von' ? store.von() : store.bis();
}

function hasChangesInGroup(group: PointTypeState): boolean {
  return group.points.some((p) => p.isNew || p.isModified) || group.deletedObjectIds.length > 0;
}

export const ReferencePointStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed((store) => ({
    hasRelationships: computed(() => store.von().relationship != null || store.bis().relationship != null),
    isAdding: computed(() => store.addingType() != null),
    hasPendingChanges: computed(() => hasChangesInGroup(store.von()) || hasChangesInGroup(store.bis())),
  })),
  withMethods((store) => ({
    initialize(
      vonRel: ReferencePointRelationshipInfo | undefined,
      bisRel: ReferencePointRelationshipInfo | undefined,
    ): void {
      patchState(store, {
        von: { ...INITIAL_POINT_TYPE_STATE, relationship: vonRel },
        bis: { ...INITIAL_POINT_TYPE_STATE, relationship: bisRel },
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
      const group = getGroup(store, type);
      patchState(store, { [type]: { ...group, points } });
    },
    addPoint(type: ReferencePointType, point: ReferencePoint): void {
      const group = getGroup(store, type);
      patchState(store, { [type]: { ...group, points: [...group.points, point] } });
    },
    updatePoint(type: ReferencePointType, index: number, point: ReferencePoint): void {
      const group = getGroup(store, type);
      const points = [...group.points];
      points[index] = point;
      patchState(store, { [type]: { ...group, points } });
    },
    removePoint(type: ReferencePointType, index: number): void {
      const group = getGroup(store, type);
      const points = [...group.points];
      const removed = points.splice(index, 1)[0];
      const deletedObjectIds =
        removed && !removed.isNew && removed.objectId != null
          ? [...group.deletedObjectIds, removed.objectId]
          : group.deletedObjectIds;
      patchState(store, { [type]: { ...group, points, deletedObjectIds } });
    },
    setActiveEdit(edit: { type: ReferencePointType; index: number } | undefined): void {
      patchState(store, { activeEdit: edit });
    },
    startAdding(type: ReferencePointType): void {
      patchState(store, { addingType: type, addingGeometry: undefined, addingAttributes: {} });
    },
    setAddingGeometry(geometry: Point): void {
      patchState(store, { addingGeometry: geometry });
    },
    updateAddingAttribute(fieldName: string, value: AttributeValue): void {
      patchState(store, { addingAttributes: { ...store.addingAttributes(), [fieldName]: value } });
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
