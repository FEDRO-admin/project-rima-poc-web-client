export interface HistoricMomentEntry {
  name: string;
  date: string;
}

const SOE_BASE_URL = 'https://rima-poc.astra.admin.ch/arcgis/rest/services/soe_placeholder/MapServer/exts/RimaSoe';

export const HISTORIC_MOMENTS_URL = `${SOE_BASE_URL}/getHistoricMoments`;
export const HISTORIC_MOMENTS_ADD_URL = `${SOE_BASE_URL}/addHistoricMoment`;
export const HISTORIC_MOMENTS_DELETE_URL = `${SOE_BASE_URL}/delHistoricMoment`;
