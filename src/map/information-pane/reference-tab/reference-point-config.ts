import SimpleMarkerSymbol from '@arcgis/core/symbols/SimpleMarkerSymbol';
import type { ReferencePointType } from './reference-point-types';

export const REF_POINT_FK_PARENT_FIELD = 'fk_parent';
export const REF_POINT_PARENT_CLASS_NAME_FIELD = 'parent_class_name';

export const REF_POINT_AUTO_POPULATED_FIELDS: readonly string[] = [
  REF_POINT_FK_PARENT_FIELD,
  REF_POINT_PARENT_CLASS_NAME_FIELD,
];

const REF_POINT_VON_SYMBOL = new SimpleMarkerSymbol({
  style: 'circle',
  color: [0, 121, 193, 0.8],
  size: 10,
  outline: { color: [255, 255, 255], width: 2 },
});

const REF_POINT_BIS_SYMBOL = new SimpleMarkerSymbol({
  style: 'circle',
  color: [193, 64, 0, 0.8],
  size: 10,
  outline: { color: [255, 255, 255], width: 2 },
});

export const REF_POINT_ADDING_SYMBOL = new SimpleMarkerSymbol({
  style: 'diamond',
  color: [46, 204, 113, 0.9],
  size: 12,
  outline: { color: [255, 255, 255], width: 2 },
});

export const REFERENCE_POINT_TYPES = ['von', 'bis'] as const;

export const REF_POINT_SYMBOLS: Record<ReferencePointType, SimpleMarkerSymbol> = {
  von: REF_POINT_VON_SYMBOL,
  bis: REF_POINT_BIS_SYMBOL,
};
