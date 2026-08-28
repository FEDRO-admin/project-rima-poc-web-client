import type Field from '@arcgis/core/layers/support/Field';

export interface FieldsCapableLayer {
  fields: Field[];
}

export function hasFieldMetadata(layer: unknown): layer is FieldsCapableLayer {
  return (
    layer != null &&
    Array.isArray((layer as FieldsCapableLayer).fields) &&
    (layer as FieldsCapableLayer).fields.length > 0
  );
}

export function isImmutableField(fieldName: string, layer: FieldsCapableLayer): boolean {
  const lowerName = fieldName.toLowerCase();
  const field = layer.fields?.find((f) => f.name.toLowerCase() === lowerName);
  if (!field) {
    return false;
  }
  return !field.editable;
}
