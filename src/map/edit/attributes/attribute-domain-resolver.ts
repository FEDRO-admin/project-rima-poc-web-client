import Graphic from '@arcgis/core/Graphic';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import type Field from '@arcgis/core/layers/support/Field';
import type CodedValueDomain from '@arcgis/core/layers/support/CodedValueDomain';
import type Domain from '@arcgis/core/layers/support/Domain';
import { AttributeCodedValueOption, AttributeEditField, convertAttributeFieldType } from './attribute-edit-field';
import { isSystemField } from '../edit-capability';

export function resolveEditableAttributeFields(graphic: Graphic): AttributeEditField[] {
  const layer = graphic.layer;
  if (!(layer instanceof FeatureLayer) || !layer.fields?.length) {
    return [];
  }

  const subtypeDomains = resolveSubtypeDomains(graphic, layer);

  return layer.fields
    .filter((field) => field.editable && !isSystemField(field.name))
    .map((field) => buildEditAttributeField(field, layer, subtypeDomains));
}

function resolveSubtypeDomains(graphic: Graphic, layer: FeatureLayer): Record<string, Domain> | undefined {
  if (!layer.typeIdField || !layer.types?.length) {
    return undefined;
  }

  const typeValue = graphic.attributes?.[layer.typeIdField];
  const activeType = layer.types.find((t) => t.id === typeValue);
  return activeType?.domains as Record<string, Domain> | undefined;
}

function buildEditAttributeField(
  field: Field,
  layer: FeatureLayer,
  subtypeDomains: Record<string, Domain> | undefined,
): AttributeEditField {
  // The typeIdField itself becomes a dropdown of available subtypes
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

  // Subtype-specific domain takes precedence over field-level domain
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

function isCodedValueDomain(domain: unknown): domain is CodedValueDomain {
  return domain != null && typeof domain === 'object' && 'type' in domain && domain.type === 'coded-value';
}
