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

export function resolveEditableAttributeFields(graphic: Graphic): AttributeEditField[] {
  const layer = graphic.layer;
  if (!(layer instanceof FeatureLayer) || !layer.fields?.length) {
    return [];
  }

  return layer.fields
    .filter((field) => !isImmutableField(field.name, layer))
    .map((field) => buildEditAttributeField(field));
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

  if (isCodedValueDomain(field.domain)) {
    const match = field.domain.codedValues?.find((cv) => cv.code === value);
    return match?.name ?? value;
  }

  if (isDateField(field) && typeof value === 'number') {
    return formatDateDisplay(value);
  }

  return value;
}

export function buildEditAttributeField(field: Field): AttributeEditField {
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

function isDateField(field: Field): boolean {
  return (
    field.type === 'date' ||
    field.type === 'date-only' ||
    field.type === 'time-only' ||
    field.type === 'timestamp-offset'
  );
}

function formatDateDisplay(epoch: number): string {
  const date = new Date(epoch);
  if (Number.isNaN(date.getTime())) return String(epoch);
  return date.toLocaleString();
}
