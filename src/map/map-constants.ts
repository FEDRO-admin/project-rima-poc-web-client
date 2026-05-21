import Extent from '@arcgis/core/geometry/Extent';

import { WebmapLayerType } from './webmap/webmap-types';

export const RIMA_PORTAL_URL = 'https://rima-poc.switzerlandnorth.cloudapp.azure.com/arcgis';

export const RIMA_CATALOG_INCLUDED_LAYER_TYPES: readonly WebmapLayerType[] = [
  'ArcGISFeatureLayer',
  'ArcGISMapServiceLayer',
  'WebTiledLayer',
];
export const RIMA_CATALOG_WEBMAP_NAME_AS_SECTION = true;

// BASEMAP
export const RIMA_BASEMAP_DEFAULT_ID = '7bd6e81998384d5b89c090cfcae88aca';

// SPATIAL REFERENCES
export const RIMA_SPATIAL_REFERENCE_LV95_EPSG = 2056;
export const RIMA_SPATIAL_REFERENCE_WGS84_EPSG = 4326;

// EXTENTS
export const RIMA_SWITZERLAND_EXTENT = new Extent({
  xmin: 2465000,
  xmax: 2855000,
  ymin: 1055000,
  ymax: 1320000,
  spatialReference: { wkid: RIMA_SPATIAL_REFERENCE_LV95_EPSG },
});
