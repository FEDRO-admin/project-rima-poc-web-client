import { STATUS_LAYER_NAME } from '../../map-config';

export { STATUS_LAYER_NAME };

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
  1: 'sehr gut',
  2: 'mittel/akzeptabel',
  3: 'ausreichend/beschädigt',
  4: 'kritisch/schlecht',
  5: 'schlecht/alarmierend',
};
