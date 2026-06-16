import type Field from '@arcgis/core/layers/support/Field';

export type EditFieldType = 'string' | 'integer' | 'double' | 'date' | 'coded-value' | 'subtype';

export interface CodedValueOption {
  code: string | number;
  name: string;
}

export interface EditField {
  name: string;
  alias: string;
  fieldType: EditFieldType;
  nullable: boolean;
  length: number | undefined;
  codedValues: CodedValueOption[];
  editable: boolean;
}

export function mapFieldType(field: Field, isSubtypeField: boolean): EditFieldType {
  if (isSubtypeField) {
    return 'subtype';
  }

  if (field.domain?.type === 'coded-value') {
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
