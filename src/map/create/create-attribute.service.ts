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
import { getSubtypeFieldName } from '../layer/layer-sub-types';

type AttributeValue = string | number | boolean | null;

export function resolveCreatableFields(layer: FeatureLayer, subtypeValue?: string | number): AttributeEditField[] {
  if (!layer.fields?.length) {
    return [];
  }

  const subtypeDomains = resolveSubtypeDomains(layer, subtypeValue);

  return layer.fields
    .filter((field) => !isImmutableField(field.name, layer))
    .map((field) => buildCreatableField(field, subtypeDomains));
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
  const subtypeField = getSubtypeFieldName(layer);
  if (!subtypeField || subtypeValue == null) {
    return undefined;
  }

  if (layer.types?.length) {
    const activeType = layer.types.find((t) => t.id === subtypeValue);
    return activeType?.domains as Record<string, Domain> | undefined;
  }

  const sourceSubtypes = layer.sourceJSON?.['subtypes'] as
    | { code: string | number; domains?: Record<string, Domain> }[]
    | undefined;
  if (sourceSubtypes?.length) {
    const activeSubtype = sourceSubtypes.find((s) => s.code === subtypeValue);
    if (activeSubtype?.domains) {
      const resolved: Record<string, Domain> = {};
      for (const [key, domain] of Object.entries(activeSubtype.domains)) {
        if ((domain as { type?: string })?.type !== 'inherited') {
          resolved[key] = domain;
        }
      }
      return Object.keys(resolved).length > 0 ? resolved : undefined;
    }
  }

  return undefined;
}

function buildCreatableField(field: Field, subtypeDomains: Record<string, Domain> | undefined): AttributeEditField {
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
