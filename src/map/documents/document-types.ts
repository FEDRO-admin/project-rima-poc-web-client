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
