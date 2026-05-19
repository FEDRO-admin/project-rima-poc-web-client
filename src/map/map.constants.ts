import Extent from '@arcgis/core/geometry/Extent';

export const RIMA_PORTAL_URL = 'https://rima-poc.switzerlandnorth.cloudapp.azure.com/arcgis';
export const RIMA_WEB_MAP_ITEM_ID = 'eef443f54c764a72bcadb08a9bc86d9d';

export const RIMA_SPATIAL_REFERENCE_LV95_EPSG = 2056;
export const RIMA_SPATIAL_REFERENCE_WGS84_EPSG = 4326;

export const RIMA_SWITZERLAND_EXTENT = new Extent({
  xmin: 2465000,
  xmax: 2855000,
  ymin: 1055000,
  ymax: 1320000,
  spatialReference: { wkid: RIMA_SPATIAL_REFERENCE_LV95_EPSG },
});
