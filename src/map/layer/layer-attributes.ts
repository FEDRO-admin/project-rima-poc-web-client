import { EditableLayer } from './editable-layer';
import { getSubtypeFieldName } from './layer-sub-types';

export function isImmutableField(fieldName: string, layer: EditableLayer): boolean {
  const lowerName = fieldName.toLowerCase();
  const field = layer.fields?.find((f) => f.name.toLowerCase() === lowerName);
  if (!field) {
    return false;
  }
  if (!field.editable) {
    return true;
  }
  const subtypeField = getSubtypeFieldName(layer);
  if (subtypeField && field.name === subtypeField) {
    return true;
  }
  return false;
}
