import type Point from '@arcgis/core/geometry/Point';

export type AttributeValue = string | number | boolean | null;

export interface StatusRecord {
  objectId: number | undefined;
  globalId: string | undefined;
  attributes: Record<string, AttributeValue>;
  geometry: Point | undefined;
  isNew: boolean;
  isModified: boolean;
}
