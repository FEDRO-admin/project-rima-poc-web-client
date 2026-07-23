import SimpleMarkerSymbol from '@arcgis/core/symbols/SimpleMarkerSymbol';

/**
 * Field names used on the reference point FeatureService layers.
 * Centralised here so they can be updated in one place if the schema changes.
 */

/** Foreign-key field linking a reference point to its parent feature's `id`. */
export const REF_POINT_FK_PARENT_FIELD = 'fk_parent';

/** Field storing the parent layer's service-level layer ID (numeric). */
export const REF_POINT_PARENT_CLASS_NAME_FIELD = 'parent_class_name';

/** Fields that are auto-populated on save and must not appear in the edit form. */
export const REF_POINT_AUTO_POPULATED_FIELDS: readonly string[] = [
  REF_POINT_FK_PARENT_FIELD,
  REF_POINT_PARENT_CLASS_NAME_FIELD,
];

/** Symbol for "Von" reference points (blue circle). */
export const REF_POINT_VON_SYMBOL = new SimpleMarkerSymbol({
  style: 'circle',
  color: [0, 121, 193, 0.8],
  size: 10,
  outline: { color: [255, 255, 255], width: 2 },
});

/** Symbol for "Bis" reference points (red circle). */
export const REF_POINT_BIS_SYMBOL = new SimpleMarkerSymbol({
  style: 'circle',
  color: [193, 64, 0, 0.8],
  size: 10,
  outline: { color: [255, 255, 255], width: 2 },
});
