import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import type Field from '@arcgis/core/layers/support/Field';
import type CodedValueDomain from '@arcgis/core/layers/support/CodedValueDomain';
import type Domain from '@arcgis/core/layers/support/Domain';
import {
  AttributeCodedValueOption,
  AttributeEditField,
  convertAttributeFieldType,
} from '../shared/attribute-edit-field';
import { isImmutableField } from '../layer/layer-attributes';

type AttributeValue = string | number | boolean | null;

export function resolveCreatableFields(layer: FeatureLayer): AttributeEditField[] {
  if (!layer.fields?.length) {
    return [];
  }

  return layer.fields
    .filter((field) => !isImmutableField(field.name, layer))
    .map((field) => buildCreatableField(field));
}

export function buildDefaultAttributes(
  layer: FeatureLayer,
  fields: AttributeEditField[],
): Record<string, AttributeValue> {
  const attributes: Record<string, AttributeValue> = {};

  for (const editField of fields) {
    if (editField.fieldType === 'guid') {
      attributes[editField.name] = null;
      continue;
    }
    const layerField = layer.fields.find((f) => f.name === editField.name);
    const defaultValue = layerField?.defaultValue as AttributeValue | undefined;
    attributes[editField.name] = defaultValue ?? null;
  }

  return attributes;
}

function buildCreatableField(field: Field): AttributeEditField {
  const fieldType = convertAttributeFieldType(field, field.domain);
  const codedValues = resolveCodedValues(field.domain);

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
