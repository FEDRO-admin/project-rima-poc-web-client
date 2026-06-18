import type Field from '@arcgis/core/layers/support/Field';

export type AttributeEditFieldType = 'string' | 'integer' | 'double' | 'date' | 'coded-value';

export interface AttributeCodedValueOption {
  code: string | number;
  name: string;
}

export interface AttributeEditField {
  name: string;
  alias: string;
  fieldType: AttributeEditFieldType;
  nullable: boolean;
  length: number | undefined;
  codedValues: AttributeCodedValueOption[];
  editable: boolean;
}

export function convertAttributeFieldType(
  field: Field,
  domain?: { type?: string | null } | null,
): AttributeEditFieldType {
  const effectiveDomain = domain ?? field.domain;
  if (effectiveDomain?.type === 'coded-value') {
    return 'coded-value';
  }

  switch (field.type) {
    case 'small-integer':
    case 'integer':
    case 'oid':
    case 'long':
    case 'big-integer':
      return 'integer';
    case 'single':
    case 'double':
      return 'double';
    case 'date':
    case 'date-only':
    case 'time-only':
    case 'timestamp-offset':
      return 'date';
    case 'string':
    case 'geometry':
    case 'blob':
    case 'raster':
    case 'guid':
    case 'global-id':
    case 'xml':
      return 'string';
  }
}
