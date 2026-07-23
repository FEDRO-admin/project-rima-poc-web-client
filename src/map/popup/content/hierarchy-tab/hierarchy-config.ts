/**
 * The field name used for display labels in the hierarchy tree.
 * Set to a field name (e.g. 'titel') to use that field's value as the node label.
 * Set to '___LAYERNAME___' to use the layer title instead of a field value.
 */
export const HIERARCHY_DISPLAY_FIELD = '___LAYERNAME___';

/**
 * The field name used for the bracket suffix shown after the display label (e.g. "Label [BracketValue]").
 * Set to a field name to use that field's value inside the brackets.
 * Set to '___LAYERNAME___' to use the layer title.
 * Set to undefined to never show brackets.
 * If the configured field is not found on a feature, brackets are omitted for that node.
 */
export const HIERARCHY_BRACKET_FIELD: string | undefined = 'object_type';

export const LAYER_NAME_WILDCARD = '___LAYERNAME___';
