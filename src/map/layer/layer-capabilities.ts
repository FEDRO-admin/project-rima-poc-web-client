import Graphic from '@arcgis/core/Graphic';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import Layer from '@arcgis/core/layers/Layer';

export function isLayerEditable(graphic: Graphic): boolean {
  const layer = graphic.layer;
  if (!(layer instanceof FeatureLayer)) {
    return false;
  }

  if (!layer.editingEnabled) {
    return false;
  }

  const editing = layer.capabilities?.editing;
  if (!editing?.supportsUpdateByOthers) {
    return false;
  }

  return true;
}

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

function isEffectivelyVisible(layer: FeatureLayer): boolean {
  let current: Layer | null | undefined = layer;
  while (current instanceof Layer) {
    if (!current.visible) {
      return false;
    }
    // walk up tree to check if group layer is visible
    current = current.parent instanceof Layer ? current.parent : null;
  }
  return true;
}
