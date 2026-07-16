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
    case 'date':
      return convertDateValue(rawValue);
    case 'guid':
    case 'string':
      return rawValue;
  }
}

function convertDateValue(rawValue: string): number | null {
  const timestamp = new Date(rawValue).getTime();
  return Number.isNaN(timestamp) ? null : timestamp;
}

/**
 * Formats an epoch-milliseconds timestamp to a datetime-local input value (YYYY-MM-DDTHH:MM).
 * Returns an empty string if the value is not a valid number.
 */
export function formatDateForInput(value: AttributeValue): string {
  if (typeof value !== 'number' || Number.isNaN(value)) return '';
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/**
 * Formats an epoch-milliseconds timestamp to a human-readable date string for display.
 * Returns an empty string if the value is not a valid number.
 */
export function formatDateDisplay(value: AttributeValue): string {
  if (typeof value !== 'number' || Number.isNaN(value)) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString();
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
