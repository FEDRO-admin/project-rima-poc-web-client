import { computed } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { StatusRecord, AttributeValue } from './status-types';

export interface StatusFieldEntry {
  label: string;
  value: AttributeValue;
}

interface StatusState {
  record: StatusRecord | undefined;
  originalAttributes: Record<string, AttributeValue>;
  editedAttributes: Record<string, AttributeValue>;
  deleted: boolean;
  creating: boolean;
  saving: boolean;
  loading: boolean;
  relationshipId: number | undefined;
}

const initialState: StatusState = {
  record: undefined,
  originalAttributes: {},
  editedAttributes: {},
  deleted: false,
  creating: false,
  saving: false,
  loading: false,
  relationshipId: undefined,
};

export const StatusStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed((store) => ({
    hasPendingChanges: computed(() => {
      if (store.deleted()) return true;
      if (store.creating()) return true;
      const original = store.originalAttributes();
      const edited = store.editedAttributes();
      return Object.keys(edited).some((key) => edited[key] !== original[key]);
    }),
    hasRecord: computed(() => store.record() != null),
    available: computed(() => store.relationshipId() != null),
    showForm: computed(() => store.record() != null && !store.deleted()),
    showCreateForm: computed(() => store.creating()),
    showCreateButton: computed(() => store.relationshipId() != null && store.record() == null && !store.creating()),
    showDeleteButton: computed(() => store.record() != null && !store.deleted()),
  })),
  withMethods((store) => ({
    setup(relationshipId: number): void {
      patchState(store, { relationshipId });
    },
    setRecord(record: StatusRecord | undefined): void {
      const attributes = record?.attributes ?? {};
      patchState(store, {
        record,
        originalAttributes: { ...attributes },
        editedAttributes: { ...attributes },
        deleted: false,
        creating: false,
      });
    },
    setLoading(loading: boolean): void {
      patchState(store, { loading });
    },
    setSaving(saving: boolean): void {
      patchState(store, { saving });
    },
    updateField(fieldName: string, value: AttributeValue): void {
      patchState(store, { editedAttributes: { ...store.editedAttributes(), [fieldName]: value } });
    },
    markDeleted(): void {
      patchState(store, { deleted: true });
    },
    markCreating(): void {
      patchState(store, { creating: true, editedAttributes: {} });
    },
    cancelCreating(): void {
      patchState(store, { creating: false, editedAttributes: {} });
    },
    reset(): void {
      patchState(store, initialState);
    },
  })),
);
