import Graphic from '@arcgis/core/Graphic';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';

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

export function isLayerDeletable(graphic: Graphic): boolean {
  const layer = graphic.layer;
  if (!(layer instanceof FeatureLayer)) {
    return false;
  }

  if (!layer.editingEnabled) {
    return false;
  }

  const operations = layer.capabilities?.operations;
  if (!operations?.supportsDelete) {
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
