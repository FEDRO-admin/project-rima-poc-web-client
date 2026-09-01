import { STATUS_LAYER_NAME, STATUS_MAP_LAYER_TITLE } from '../../map-config';

export { STATUS_LAYER_NAME, STATUS_MAP_LAYER_TITLE };

export const STATUS_FK_PARENT_FIELD = 'fk_parent';
export const STATUS_PARENT_CLASS_NAME_FIELD = 'parent_class_name';
export const STATUS_OBJECT_TYPE_FIELD = 'object_type';

export const STATUS_AUTO_POPULATED_FIELDS: readonly string[] = [
  STATUS_FK_PARENT_FIELD,
  STATUS_PARENT_CLASS_NAME_FIELD,
  STATUS_OBJECT_TYPE_FIELD,
];

export const BEWERTUNGSDATUM_FIELD = 'bewertungsdatum';

export const ZUSTANDSKLASSE_COLORS: Record<number, string> = {
  1: '#2ecc71',
  2: '#a3d977',
  3: '#f1c40f',
  4: '#e67e22',
  5: '#e74c3c',
};

export const ZUSTANDSKLASSE_LABELS: Record<number, string> = {
  1: 'status.class.1',
  2: 'status.class.2',
  3: 'status.class.3',
  4: 'status.class.4',
  5: 'status.class.5',
};
