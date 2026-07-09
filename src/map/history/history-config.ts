export interface HistoricMomentEntry {
  name: string;
  date: string;
}

export const HISTORIC_MOMENTS_URL =
  'https://rima-poc.astra.admin.ch/arcgis/rest/services/soe_placeholder/MapServer/exts/RimaSoe/getHistoricMoments';
