import Graphic from '@arcgis/core/Graphic';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import type Field from '@arcgis/core/layers/support/Field';
import type CodedValueDomain from '@arcgis/core/layers/support/CodedValueDomain';
import type Domain from '@arcgis/core/layers/support/Domain';
import {
  AttributeCodedValueOption,
  AttributeEditField,
  convertAttributeFieldType,
} from '../shared/attribute-edit-field';
import { isImmutableField } from './layer-attributes';
import { getSubtypeFieldName, getSubtypes } from './layer-sub-types';

export function resolveEditableAttributeFields(graphic: Graphic): AttributeEditField[] {
  const layer = graphic.layer;
  if (!(layer instanceof FeatureLayer) || !layer.fields?.length) {
    return [];
  }

  const subtypeDomains = resolveSubtypeDomains(graphic, layer);

  return layer.fields
    .filter((field) => !isImmutableField(field.name, layer))
    .map((field) => buildEditAttributeField(field, subtypeDomains));
}

export function resolveFieldDisplayValue(
  graphic: Graphic,
  field: Field,
  value: string | number | boolean | null | undefined,
): string | number | boolean | null {
  if (value == null) {
    return null;
  }

  const layer = graphic.layer;
  if (!(layer instanceof FeatureLayer)) {
    return value;
  }

  const subtypeField = getSubtypeFieldName(layer);
  if (subtypeField && field.name === subtypeField) {
    const subtypes = getSubtypes(layer);
    const match = subtypes.find((s) => s.code === value);
    return match?.name ?? value;
  }

  const subtypeDomains = resolveSubtypeDomains(graphic, layer);
  const effectiveDomain = subtypeDomains?.[field.name] ?? field.domain;

  if (isCodedValueDomain(effectiveDomain)) {
    const match = effectiveDomain.codedValues?.find((cv) => cv.code === value);
    return match?.name ?? value;
  }

  return value;
}

function resolveSubtypeDomains(graphic: Graphic, layer: FeatureLayer): Record<string, Domain> | undefined {
  const subtypeField = getSubtypeFieldName(layer);
  if (!subtypeField) {
    return undefined;
  }

  const subtypeValue = graphic.attributes?.[subtypeField];

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

function buildEditAttributeField(field: Field, subtypeDomains: Record<string, Domain> | undefined): AttributeEditField {
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
