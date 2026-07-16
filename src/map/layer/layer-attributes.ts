import FeatureLayer from '@arcgis/core/layers/FeatureLayer';

export function isImmutableField(fieldName: string, layer: FeatureLayer): boolean {
  const lowerName = fieldName.toLowerCase();
  const field = layer.fields?.find((f) => f.name.toLowerCase() === lowerName);
  if (!field) {
    return false;
  }
  return !field.editable;
}
