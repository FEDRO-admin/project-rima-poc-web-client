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

  return layer.fields
    .filter((field) => field.editable && !isSystemField(field.name))
    .map((field) => buildEditField(field));
}

function buildEditField(field: Field): EditField {
  const fieldType = mapFieldType(field);
  const codedValues = resolveCodedValues(field);

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

function resolveCodedValues(field: Field): CodedValueOption[] {
  // Fall back to field's default domain
  if (isCodedValueDomain(field.domain)) {
    return field.domain.codedValues.map((cv) => ({ code: cv.code, name: cv.name }));
  }

  return [];
}

function isCodedValueDomain(domain: unknown): domain is CodedValueDomain {
  return domain != null && typeof domain === 'object' && 'type' in domain && domain.type === 'coded-value';
}
