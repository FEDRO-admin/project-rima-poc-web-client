import type { AttributeValue } from '../../shared/attribute-value-conversion';

export interface DocumentRecord {
  objectId: number;
  attributes: Record<string, AttributeValue>;
}

export type DocumentAccessLevel = 'private' | 'org' | 'public';

export interface DocumentSharingOptions {
  access: DocumentAccessLevel;
}

export interface DocumentUploadPayload {
  file: File;
  sharing: DocumentSharingOptions;
  editableAttributes: Record<string, AttributeValue>;
}

export interface DocumentEditPayload {
  editableAttributes: Record<string, AttributeValue>;
  file?: File;
  sharing?: DocumentSharingOptions;
}
