import { WebmapLayerType } from './mapview-types';

// BASEMAP
export const RIMA_MAPVIEW_BASEMAP_WMTS_URL = 'https://wmts.geo.admin.ch/EPSG/2056/1.0.0/WMTSCapabilities.xml';
export const RIMA_MAPVIEW_BASEMAP_LAYER_ID = 'ch.swisstopo.pixelkarte-farbe';

// CATALOG
export const RIMA_CATALOG_INCLUDED_LAYER_TYPES: readonly WebmapLayerType[] = [
  'ArcGISFeatureLayer',
  //'ArcGISMapServiceLayer',
  'WebTiledLayer',
];
export const RIMA_CATALOG_WEBMAP_NAME_AS_SECTION = true;
