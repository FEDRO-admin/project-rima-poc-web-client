import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { computed } from '@angular/core';
import WebMap from '@arcgis/core/WebMap';
import Portal from '@arcgis/core/portal/Portal';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import type Layer from '@arcgis/core/layers/Layer';
import type Collection from '@arcgis/core/core/Collection';
import { PORTAL_URL, WEB_MAP_ITEM_ID } from '../map/layers/web-map.config';

interface LayersState {
  loaded: boolean;
}

export const LayersStore = signalStore(
  { providedIn: 'root' },
  withState<LayersState>({ loaded: false }),
  withMethods((store) => {
    let webMap: WebMap | null = null;

    return {
      async initialize(): Promise<void> {
        try {
          webMap = new WebMap({
            portalItem: {
              id: WEB_MAP_ITEM_ID,
              portal: new Portal({ url: PORTAL_URL }),
            },
          });

          await webMap.load();
          patchState(store, { loaded: true });

          console.warn('[LayersStore] WebMap loaded successfully', {
            layers: webMap.layers.map((layer) => layer.title).toArray(),
          });
        } catch (error) {
          console.error('[LayersStore] Failed to load WebMap', error);
        }
      },

      getWebMap(): WebMap | null {
        return webMap;
      },

      getHierarchy(): Collection<Layer> | undefined {
        return webMap?.layers;
      },

      findLayerById(id: string): Layer | undefined {
        return webMap?.findLayerById(id) ?? undefined;
      },

      getFeatureLayerById(id: string): FeatureLayer | undefined {
        const layer = webMap?.findLayerById(id) ?? undefined;
        return layer instanceof FeatureLayer ? layer : undefined;
      },

      // e.g. DE/Achsen/Bezugspunkt
      getFeatureLayerByPath(path: string): FeatureLayer | undefined {
        if (!webMap || !path) return undefined;

        let currentLayers: Collection<Layer> = webMap.layers;
        let current: Layer | undefined;

        for (const segment of path.split('/')) {
          current = currentLayers.find((l) => l.title === segment);
          if (!current) return undefined;

          const sublayers = (current as { layers?: Collection<Layer> }).layers;
          if (sublayers) {
            currentLayers = sublayers;
          }
        }

        return current instanceof FeatureLayer ? current : undefined;
      },

      toggleLayerVisibility(id: string): void {
        const layer = webMap?.findLayerById(id);
        if (layer) {
          layer.visible = !layer.visible;
        }
      },
    };
  }),
  withComputed((store) => ({
    isLoaded: computed(() => store.loaded()),
  })),
);
