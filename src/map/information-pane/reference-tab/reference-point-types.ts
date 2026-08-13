import type Point from '@arcgis/core/geometry/Point';

import { REFERENCE_POINT_TYPES } from './reference-point-config';

export type ReferencePointType = (typeof REFERENCE_POINT_TYPES)[number];

export type AttributeValue = string | number | boolean | null;

export interface ReferencePoint {
  clientId: string;
  type: ReferencePointType | undefined;
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
