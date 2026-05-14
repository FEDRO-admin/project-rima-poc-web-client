import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import type { ResolvedLayer } from '../map/layers/resolved-layer';
import { MapServerService } from '../map/layers/map-server.service';
import { FeatureServerService } from '../map/layers/feature-server.service';

export type { ResolvedLayer };

interface LayersState {
  de: ResolvedLayer[];
  fr: ResolvedLayer[];
  it: ResolvedLayer[];
}

export const LayersStore = signalStore(
  { providedIn: 'root' },
  withState<LayersState>({ de: [], fr: [], it: [] }),
  withMethods(
    (store, mapServerService = inject(MapServerService), featureServerService = inject(FeatureServerService)) => {
      const resolveLayersForGroup = async (layerIds: number[]): Promise<ResolvedLayer[]> => {
        const layerRequests = layerIds.map((layerId) => featureServerService.resolveLayer(layerId));
        return Promise.all(layerRequests);
      };

      return {
        async initialize(): Promise<void> {
          try {
            const languageGroups = await mapServerService.getLanguageGroups();

            const [de, fr, it] = await Promise.all([
              resolveLayersForGroup(languageGroups.de),
              resolveLayersForGroup(languageGroups.fr),
              resolveLayersForGroup(languageGroups.it),
            ]);

            patchState(store, { de, fr, it });

            console.warn('[LayersStore] Layers loaded successfully', {
              de: de.map((r) => r.featureLayer.url),
              fr: fr.map((r) => r.featureLayer.url),
              it: it.map((r) => r.featureLayer.url),
            });
          } catch (error) {
            console.error('[LayersStore] Failed to load layers from server', error);
          }
        },
        setLayers(resolvedLayers: { de: ResolvedLayer[]; fr: ResolvedLayer[]; it: ResolvedLayer[] }): void {
          patchState(store, resolvedLayers);
        },
      };
    },
  ),
  withComputed((store) => ({
    deLayers: computed(() => store.de()),
    frLayers: computed(() => store.fr()),
    itLayers: computed(() => store.it()),
    all: computed(() => {
      const unique = new Set<ResolvedLayer>();
      [...store.de(), ...store.fr(), ...store.it()].forEach((r) => unique.add(r));
      return [...unique];
    }),
    featureLayers: computed(() => {
      const unique = new Set<ResolvedLayer>();
      [...store.de(), ...store.fr(), ...store.it()].forEach((r) => unique.add(r));
      return [...unique].map((r) => r.featureLayer);
    }),
    searchSources: computed(() => {
      const unique = new Set<ResolvedLayer>();
      [...store.de(), ...store.fr(), ...store.it()].forEach((r) => unique.add(r));
      return [...unique].map((r) => r.searchSource).filter((s) => s !== undefined);
    }),
  })),
);
