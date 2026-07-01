import type Point from '@arcgis/core/geometry/Point';
import type FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import type { AttributeEditField } from '../attribute-edit-field';

export type ReferencePointType = 'von' | 'bis';

export type AttributeValue = string | number | boolean | null;

export interface ReferencePoint {
  objectId: number | undefined;
  globalId: string | undefined;
  geometry: Point | undefined;
  attributes: Record<string, AttributeValue>;
  isNew: boolean;
  isModified: boolean;
}

export interface ReferencePointRelationshipInfo {
  type: ReferencePointType;
  relationshipId: number;
  relatedLayer: FeatureLayer;
  fields: AttributeEditField[];
}

/**
 * Matches layer titles containing "punkt" combined with "von" or "bis"
 * in any order (e.g. "Von Punkte", "Bis Punkte", "Punkte_von", etc.)
 */
const VON_PATTERN = /punkt.*von|von.*punkt/i;
const BIS_PATTERN = /punkt.*bis|bis.*punkt/i;

export function classifyRelationshipName(title: string): ReferencePointType | undefined {
  if (VON_PATTERN.test(title)) return 'von';
  if (BIS_PATTERN.test(title)) return 'bis';
  return undefined;
}
