import { computed } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import {
  INITIAL_POINT_TYPE_STATE,
  PointTypeState,
  ReferencePoint,
  ReferencePointRelationshipInfo,
} from '../../reference/reference-point-types';

interface PopupReferencePointState {
  von: PointTypeState;
  bis: PointTypeState;
  visible: boolean;
  loading: boolean;
}

const initialState: PopupReferencePointState = {
  von: INITIAL_POINT_TYPE_STATE,
  bis: INITIAL_POINT_TYPE_STATE,
  visible: false,
  loading: false,
};

export const PopupReferencePointStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed((store) => ({
    hasRelationships: computed(() => store.von().relationship != null || store.bis().relationship != null),
    hasPoints: computed(() => store.von().points.length > 0 || store.bis().points.length > 0),
  })),
  withMethods((store) => ({
    setRelationships(
      vonRel: ReferencePointRelationshipInfo | undefined,
      bisRel: ReferencePointRelationshipInfo | undefined,
    ): void {
      patchState(store, {
        von: { ...INITIAL_POINT_TYPE_STATE, relationship: vonRel },
        bis: { ...INITIAL_POINT_TYPE_STATE, relationship: bisRel },
        visible: false,
        loading: false,
      });
    },
    setLoading(loading: boolean): void {
      patchState(store, { loading });
    },
    setPoints(vonPoints: ReferencePoint[], bisPoints: ReferencePoint[]): void {
      const von = { ...store.von(), points: vonPoints };
      const bis = { ...store.bis(), points: bisPoints };
      patchState(store, { von, bis, loading: false });
    },
    setVisible(visible: boolean): void {
      patchState(store, { visible });
    },
    reset(): void {
      patchState(store, initialState);
    },
  })),
);
