import type Point from '@arcgis/core/geometry/Point';
import type FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import type { AttributeEditField } from '../shared/attribute-edit-field';

import { REFERENCE_POINT_TYPES, REF_POINT_TYPE_CONFIGS } from './reference-point-config';

export type ReferencePointType = (typeof REFERENCE_POINT_TYPES)[number];

export type AttributeValue = string | number | boolean | null;

export interface ReferencePoint {
  clientId: string;
  objectId: number | undefined;
  globalId: string | undefined;
  geometry: Point | undefined;
  attributes: Record<string, AttributeValue>;
  isNew: boolean;
  isModified: boolean;
}

let nextClientId = 0;

export function generateClientId(): string {
  return `rp-${Date.now()}-${++nextClientId}`;
}

export interface ReferencePointRelationshipInfo {
  type: ReferencePointType;
  relationshipId: number;
  relatedLayer: FeatureLayer;
  fields: AttributeEditField[];
}

export function classifyRelationshipByLayerId(layerId: number): ReferencePointType | undefined {
  for (const config of Object.values(REF_POINT_TYPE_CONFIGS)) {
    if (config.layerId === layerId) return config.type;
  }
  return undefined;
}
