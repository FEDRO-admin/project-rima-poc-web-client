import { computed } from '@angular/core';
import { signalStore, withComputed, withState } from '@ngrx/signals';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import LayerSearchSource from '@arcgis/core/widgets/Search/LayerSearchSource';
import { RimaLayerConfig } from '../map/layers/rima-layer';
import { achsenLayer } from '../map/layers/definitions/achsen.layer';

interface ResolvedLayer {
  featureLayer: FeatureLayer;
  searchSource?: LayerSearchSource;
}

function resolveLayer(config: RimaLayerConfig): ResolvedLayer {
  const featureLayer = new FeatureLayer(config.layer);
  const searchSource = config.search ? new LayerSearchSource({ ...config.search, layer: featureLayer }) : undefined;
  return { featureLayer, searchSource };
}

function resolveLayers(configs: RimaLayerConfig[]): ResolvedLayer[] {
  return configs.map(resolveLayer);
}

interface LayersState {
  de: RimaLayerConfig[];
  fr: RimaLayerConfig[];
  it: RimaLayerConfig[];
}

const initialState: LayersState = {
  de: [achsenLayer],
  fr: [achsenLayer],
  it: [achsenLayer],
};

export const LayersStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed((store) => {
    const deResolved = computed(() => resolveLayers(store.de()));
    const frResolved = computed(() => resolveLayers(store.fr()));
    const itResolved = computed(() => resolveLayers(store.it()));

    return {
      deLayers: deResolved,
      frLayers: frResolved,
      itLayers: itResolved,
      all: computed(() => {
        const unique = new Set<ResolvedLayer>();
        [...deResolved(), ...frResolved(), ...itResolved()].forEach((r) => unique.add(r));
        return [...unique];
      }),
      featureLayers: computed(() => {
        const unique = new Set<ResolvedLayer>();
        [...deResolved(), ...frResolved(), ...itResolved()].forEach((r) => unique.add(r));
        return [...unique].map((r) => r.featureLayer);
      }),
      searchSources: computed(() => {
        const unique = new Set<ResolvedLayer>();
        [...deResolved(), ...frResolved(), ...itResolved()].forEach((r) => unique.add(r));
        return [...unique].map((r) => r.searchSource).filter((s) => s !== undefined);
      }),
    };
  }),
);
