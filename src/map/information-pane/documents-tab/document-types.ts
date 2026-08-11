import type Graphic from '@arcgis/core/Graphic';

export const DOCUMENT_FIELDS = {
  id: 'id',
  name: 'name',
  fkParent: 'fk_parent',
  parentClassName: 'parent_class_name',
  titel: 'titel',
  beschreibung: 'beschreibung',
  autor: 'autor',
  typ: 'typ',
  pfad: 'pfad',
  status: 'status',
  letzteAenderung: 'letzte_aenderung',
  version: 'version',
  groesse: 'groesse',
  anzahlSeiten: 'anzahl_seiten',
} as const;

export interface DocumentRecord {
  objectId: number;
  id: string;
  name: string;
  fkParent: string;
  parentClassName: string;
  titel: string;
  beschreibung: string;
  autor: string;
  typ: string;
  pfad: string;
  status: string;
  letzteAenderung: Date | null;
  version: string;
  groesse: number;
  anzahlSeiten: number | null;
}

export type DocumentAccessLevel = 'private' | 'org' | 'public';

export interface DocumentSharingOptions {
  access: DocumentAccessLevel;
}

export interface DocumentUploadPayload {
  file: File;
  titel: string;
  beschreibung: string;
  typ: string;
  version: string;
  status: string;
  sharing: DocumentSharingOptions;
}

export interface DocumentEditPayload {
  titel: string;
  beschreibung: string;
  typ: string;
  version: string;
  status: string;
  file?: File;
  sharing?: DocumentSharingOptions;
}

export function mapGraphicToDocumentRecord(graphic: Graphic, objectIdField: string): DocumentRecord {
  const attrs = graphic.attributes;
  return {
    objectId: attrs[objectIdField],
    id: attrs.id ?? '',
    name: attrs.name ?? '',
    fkParent: attrs.fk_parent ?? '',
    parentClassName: attrs.parent_class_name ?? '',
    titel: attrs.titel ?? '',
    beschreibung: attrs.beschreibung ?? '',
    autor: attrs.autor ?? '',
    typ: attrs.typ ?? '',
    pfad: attrs.pfad ?? '',
    status: attrs.status ?? '',
    letzteAenderung: attrs.letzte_aenderung ? new Date(attrs.letzte_aenderung) : null,
    version: attrs.version ?? '',
    groesse: attrs.groesse ?? 0,
    anzahlSeiten: attrs.anzahl_seiten ?? null,
  };
}

export function mapDocumentRecordToAttributes(
  record: DocumentRecord,
  objectIdField: string,
): Record<string, string | number | null> {
  return {
    [objectIdField]: record.objectId,
    [DOCUMENT_FIELDS.id]: record.id,
    [DOCUMENT_FIELDS.name]: record.name,
    [DOCUMENT_FIELDS.fkParent]: record.fkParent,
    [DOCUMENT_FIELDS.parentClassName]: record.parentClassName,
    [DOCUMENT_FIELDS.titel]: record.titel,
    [DOCUMENT_FIELDS.beschreibung]: record.beschreibung,
    [DOCUMENT_FIELDS.autor]: record.autor,
    [DOCUMENT_FIELDS.typ]: record.typ,
    [DOCUMENT_FIELDS.pfad]: record.pfad,
    [DOCUMENT_FIELDS.status]: record.status,
    [DOCUMENT_FIELDS.letzteAenderung]: record.letzteAenderung?.getTime() ?? null,
    [DOCUMENT_FIELDS.version]: record.version,
    [DOCUMENT_FIELDS.groesse]: record.groesse,
    [DOCUMENT_FIELDS.anzahlSeiten]: record.anzahlSeiten,
  };
}
