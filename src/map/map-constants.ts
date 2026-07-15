import Extent from '@arcgis/core/geometry/Extent';

import { WebmapLayerType } from './webmap/webmap-layer-type';

export const RIMA_PORTAL_URL = 'https://rima-poc.astra.admin.ch/arcgis';

export const RIMA_CATALOG_INCLUDED_LAYER_TYPES: readonly WebmapLayerType[] = [
  'ArcGISFeatureLayer',
  //'ArcGISMapServiceLayer',
  'WebTiledLayer',
];
export const RIMA_CATALOG_WEBMAP_NAME_AS_SECTION = true;

// BASEMAP
export const RIMA_SWISSTOPO_WMTS_URL = 'https://wmts.geo.admin.ch/EPSG/2056/1.0.0/WMTSCapabilities.xml';
export const RIMA_SWISSTOPO_BASEMAP_LAYER_ID = 'ch.swisstopo.pixelkarte-farbe';

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
