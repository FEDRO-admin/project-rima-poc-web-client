import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import Layer from '@arcgis/core/layers/Layer';
import type Map from '@arcgis/core/Map';

export function isLayerCreatable(layer: FeatureLayer): boolean {
  if (!layer.editingEnabled) {
    return false;
  }

  const operations = layer.capabilities?.operations;
  if (!operations?.supportsAdd) {
    return false;
  }

  return true;
}

export function getCreatableFeatureLayers(map: Map): FeatureLayer[] {
  const layers: FeatureLayer[] = [];
  map.allLayers.forEach((layer) => {
    if (layer instanceof FeatureLayer && isEffectivelyVisible(layer) && isLayerCreatable(layer)) {
      layers.push(layer);
    }
  });
  return layers;
}

function isEffectivelyVisible(layer: FeatureLayer): boolean {
  let current: Layer | null | undefined = layer;
  while (current instanceof Layer) {
    if (!current.visible) {
      return false;
    }
    current = current.parent instanceof Layer ? current.parent : null;
  }
  return true;
}
