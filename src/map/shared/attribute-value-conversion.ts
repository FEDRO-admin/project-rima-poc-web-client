import { AttributeCodedValueOption, AttributeEditField } from './attribute-edit-field';

export type AttributeValue = string | number | boolean | null;

export function convertAttributeValue(rawValue: string, field: AttributeEditField): string | number | null {
  if (rawValue === '') {
    return field.nullable ? null : '';
  }

  switch (field.fieldType) {
    case 'integer':
      return Number.isNaN(Number(rawValue)) ? null : Math.round(Number(rawValue));
    case 'double':
      return Number.isNaN(Number(rawValue)) ? null : Number(rawValue);
    case 'coded-value':
      return convertCodedDomainValue(rawValue, field.codedValues);
    case 'guid':
    case 'string':
    case 'date':
      return rawValue;
  }
}

export function convertCodedDomainValue(
  rawValue: string,
  codedValues: AttributeCodedValueOption[],
): string | number | null {
  const numericValue = Number(rawValue);
  if (!Number.isNaN(numericValue)) {
    const match = codedValues.find((cv) => cv.code === numericValue);
    if (match) return numericValue;
  }
  const stringMatch = codedValues.find((cv) => String(cv.code) === rawValue);
  if (stringMatch) return stringMatch.code;
  return Number.isNaN(numericValue) ? rawValue : numericValue;
}
