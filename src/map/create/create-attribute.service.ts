import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import type Field from '@arcgis/core/layers/support/Field';
import type CodedValueDomain from '@arcgis/core/layers/support/CodedValueDomain';
import type Domain from '@arcgis/core/layers/support/Domain';
import {
  AttributeCodedValueOption,
  AttributeEditField,
  convertAttributeFieldType,
} from '../edit/attributes/attribute-edit-field';
import { isSystemField } from '../edit/edit-capability';

type AttributeValue = string | number | boolean | null;

export function resolveCreatableFields(layer: FeatureLayer, subtypeValue?: string | number): AttributeEditField[] {
  if (!layer.fields?.length) {
    return [];
  }

  const subtypeDomains = resolveSubtypeDomains(layer, subtypeValue);

  return layer.fields
    .filter((field) => field.editable && !isSystemField(field.name))
    .map((field) => buildCreatableField(field, layer, subtypeDomains));
}

export function buildDefaultAttributes(
  layer: FeatureLayer,
  fields: AttributeEditField[],
): Record<string, AttributeValue> {
  const attributes: Record<string, AttributeValue> = {};

  for (const editField of fields) {
    const layerField = layer.fields.find((f) => f.name === editField.name);
    const defaultValue = layerField?.defaultValue as AttributeValue | undefined;
    attributes[editField.name] = defaultValue ?? null;
  }

  return attributes;
}

function resolveSubtypeDomains(
  layer: FeatureLayer,
  subtypeValue?: string | number,
): Record<string, Domain> | undefined {
  if (!layer.typeIdField || !layer.types?.length || subtypeValue == null) {
    return undefined;
  }

  const activeType = layer.types.find((t) => t.id === subtypeValue);
  return activeType?.domains as Record<string, Domain> | undefined;
}

function buildCreatableField(
  field: Field,
  layer: FeatureLayer,
  subtypeDomains: Record<string, Domain> | undefined,
): AttributeEditField {
  if (field.name === layer.typeIdField && layer.types?.length) {
    return {
      name: field.name,
      alias: field.alias || field.name,
      fieldType: 'coded-value',
      nullable: field.nullable,
      length: field.length ?? undefined,
      codedValues: layer.types.map((type) => ({ code: type.id as string | number, name: type.name })),
      editable: field.editable,
    };
  }

  const effectiveDomain = subtypeDomains?.[field.name] ?? field.domain;
  const fieldType = convertAttributeFieldType(field, effectiveDomain);
  const codedValues = resolveCodedValues(effectiveDomain);

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

function resolveCodedValues(domain: Domain | Field['domain'] | undefined): AttributeCodedValueOption[] {
  if (isCodedValueDomain(domain)) {
    return domain.codedValues.map((cv) => ({ code: cv.code, name: cv.name }));
  }
  return [];
}

function isCodedValueDomain(domain: Domain | null | undefined): domain is CodedValueDomain {
  return domain != null && domain.type === 'coded-value';
}
