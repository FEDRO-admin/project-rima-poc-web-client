import Graphic from '@arcgis/core/Graphic';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import { EDIT_SYSTEM_FIELDS } from './edit-config';

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

export function isSystemField(fieldName: string): boolean {
  return EDIT_SYSTEM_FIELDS.has(fieldName.toLowerCase());
}
