import { computed } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { StatusRecord, AttributeValue } from './status-types';

export interface StatusFieldEntry {
  label: string;
  value: AttributeValue;
}

interface StatusState {
  records: StatusRecord[];
  activeEditId: number | undefined;
  originalAttributes: Record<string, AttributeValue>;
  editedAttributes: Record<string, AttributeValue>;
  expandedObjectIds: number[];
  creating: boolean;
  saving: boolean;
  loading: boolean;
  relationshipId: number | undefined;
}

const initialState: StatusState = {
  records: [],
  activeEditId: undefined,
  originalAttributes: {},
  editedAttributes: {},
  expandedObjectIds: [],
  creating: false,
  saving: false,
  loading: false,
  relationshipId: undefined,
};

export const StatusComponentStore = signalStore(
  withState(initialState),
  withComputed((store) => ({
    hasPendingChanges: computed(() => {
      if (store.creating()) {
        return Object.keys(store.editedAttributes()).length > 0;
      }
      if (store.activeEditId() == null) return false;
      const original = store.originalAttributes();
      const edited = store.editedAttributes();
      return Object.keys(edited).some((key) => edited[key] !== original[key]);
    }),
    hasRecords: computed(() => store.records().length > 0),
    available: computed(() => store.relationshipId() != null),
    showCreateButton: computed(() => store.relationshipId() != null && !store.creating()),
    isEditing: computed(() => store.activeEditId() != null),
  })),
  withMethods((store) => ({
    setup(relationshipId: number): void {
      patchState(store, { relationshipId });
    },
    setRecords(records: StatusRecord[]): void {
      patchState(store, {
        records,
        activeEditId: undefined,
        originalAttributes: {},
        editedAttributes: {},
        creating: false,
      });
    },
    setLoading(loading: boolean): void {
      patchState(store, { loading });
    },
    setSaving(saving: boolean): void {
      patchState(store, { saving });
    },
    toggleExpanded(objectId: number): void {
      const ids = store.expandedObjectIds();
      const updated = ids.includes(objectId) ? ids.filter((id) => id !== objectId) : [...ids, objectId];
      patchState(store, { expandedObjectIds: updated });
    },
    startEdit(record: StatusRecord): void {
      const attributes = { ...record.attributes };
      const expandedObjectIds =
        record.objectId != null
          ? [...new Set([...store.expandedObjectIds(), record.objectId])]
          : store.expandedObjectIds();
      patchState(store, {
        activeEditId: record.objectId,
        originalAttributes: attributes,
        editedAttributes: { ...attributes },
        expandedObjectIds,
      });
    },
    cancelEdit(): void {
      patchState(store, {
        activeEditId: undefined,
        originalAttributes: {},
        editedAttributes: {},
      });
    },
    updateField(fieldName: string, value: AttributeValue): void {
      patchState(store, { editedAttributes: { ...store.editedAttributes(), [fieldName]: value } });
    },
    markCreating(): void {
      patchState(store, { creating: true, activeEditId: undefined, editedAttributes: {}, originalAttributes: {} });
    },
    cancelCreating(): void {
      patchState(store, { creating: false, editedAttributes: {}, originalAttributes: {} });
    },
    reset(): void {
      patchState(store, initialState);
    },
  })),
);
