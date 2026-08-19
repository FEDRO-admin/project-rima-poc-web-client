import { RIMA_SOE_BASE_URL } from '../map-config';

export const RBBS_TRANSFORM_URL = `${RIMA_SOE_BASE_URL}/transformXyToRbbs`;

export const RBBS_VON_FIELD = 'rbbs_von';
export const RBBS_BIS_FIELD = 'rbbs_bis';
export const RBBS_KM_VON_FIELD = 'km_von';
export const RBBS_KM_BIS_FIELD = 'km_bis';
export const RBBS_UH_ABSCHNITT_FIELD = 'uh_abschnitt';
export const RBBS_BAU_ABSCHNITT_FIELD = 'bau_abschnitt';
export const RBBS_NATIONALSTRASSE_FIELD = 'nationalstrasse';
export const RBBS_FILIALE_FIELD = 'filiale';
export const RBBS_GEBIETSEINHEIT_FIELD = 'gebietseinheit';
export const RBBS_GEMEINDENR_FIELD = 'gemeindenr';

export const RBBS_FIELDS: readonly string[] = [
  RBBS_VON_FIELD,
  RBBS_BIS_FIELD,
  RBBS_KM_VON_FIELD,
  RBBS_KM_BIS_FIELD,
  RBBS_UH_ABSCHNITT_FIELD,
  RBBS_BAU_ABSCHNITT_FIELD,
  RBBS_NATIONALSTRASSE_FIELD,
  RBBS_FILIALE_FIELD,
  RBBS_GEBIETSEINHEIT_FIELD,
  RBBS_GEMEINDENR_FIELD,
];
