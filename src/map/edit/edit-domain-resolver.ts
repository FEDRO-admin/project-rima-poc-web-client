import Graphic from '@arcgis/core/Graphic';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import type Field from '@arcgis/core/layers/support/Field';
import type CodedValueDomain from '@arcgis/core/layers/support/CodedValueDomain';
import { CodedValueOption, EditField, mapFieldType } from './edit-field';
import { isSystemField } from './edit-capability';

export function resolveEditableFields(graphic: Graphic): EditField[] {
  const layer = graphic.layer;
  if (!(layer instanceof FeatureLayer) || !layer.fields?.length) {
    return [];
  }

  const subtypeValue = layer.typeIdField ? graphic.attributes?.[layer.typeIdField] : undefined;

  return layer.fields
    .filter((field) => field.editable && !isSystemField(field.name))
    .map((field) => buildEditField(field, layer, subtypeValue));
}

export function resolveEditableFieldsForSubtype(graphic: Graphic, subtypeValue: string | number | null): EditField[] {
  const layer = graphic.layer;
  if (!(layer instanceof FeatureLayer) || !layer.fields?.length) {
    return [];
  }

  return layer.fields
    .filter((field) => field.editable && !isSystemField(field.name))
    .map((field) => buildEditField(field, layer, subtypeValue));
}

export function getSubtypeOptions(layer: FeatureLayer): CodedValueOption[] {
  if (!layer.types?.length) {
    return [];
  }
  return layer.types.map((type) => ({ code: type.id, name: type.name }));
}

function buildEditField(
  field: Field,
  layer: FeatureLayer,
  subtypeValue: string | number | null | undefined,
): EditField {
  const isSubtypeField = field.name === layer.typeIdField;
  const fieldType = mapFieldType(field, isSubtypeField);
  const codedValues = resolveCodedValues(field, layer, subtypeValue, isSubtypeField);

  return {
    name: field.name,
    alias: field.alias || field.name,
    fieldType,
    nullable: field.nullable,
    length: field.length ?? undefined,
    codedValues,
    editable: field.editable,
  };
}

function resolveCodedValues(
  field: Field,
  layer: FeatureLayer,
  subtypeValue: string | number | null | undefined,
  isSubtypeField: boolean,
): CodedValueOption[] {
  if (isSubtypeField) {
    return getSubtypeOptions(layer);
  }

  // Check subtype-specific domain override first
  if (subtypeValue != null && layer.types?.length) {
    const activeType = layer.types.find((t) => t.id === subtypeValue);
    if (activeType?.domains?.[field.name]) {
      const subtypeDomain = activeType.domains[field.name];
      if (isCodedValueDomain(subtypeDomain)) {
        return subtypeDomain.codedValues.map((cv) => ({ code: cv.code, name: cv.name }));
      }
    }
  }

  // Fall back to field's default domain
  if (isCodedValueDomain(field.domain)) {
    return field.domain.codedValues.map((cv) => ({ code: cv.code, name: cv.name }));
  }

  return [];
}

function isCodedValueDomain(domain: unknown): domain is CodedValueDomain {
  return domain != null && typeof domain === 'object' && 'type' in domain && domain.type === 'coded-value';
}
