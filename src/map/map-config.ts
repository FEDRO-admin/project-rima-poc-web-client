// PORTAL
export const RIMA_PORTAL_URL = 'https://rima-poc.astra.admin.ch/arcgis';

// SOE (Server Object Extension)
export const RIMA_SOE_BASE_URL =
  'https://rima-poc.astra.admin.ch/arcgis/rest/services/soe_placeholder/MapServer/exts/RimaSoe';

// BASEMAP SERVICES
export const RIMA_MAPVIEW_BASEMAP_WMTS_URL = 'https://wmts.geo.admin.ch/EPSG/2056/1.0.0/WMTSCapabilities.xml';
export const RIMA_BASEMAP_LAYER_ID = 'ch.swisstopo.pixelkarte-farbe';
export const RIMA_SCENEVIEW_WMS_URL = 'https://wms.geo.admin.ch/';
export const RIMA_ELEVATION_SERVICE_URL =
  'https://tiles.arcgis.com/tiles/oPre3pOfRfefL8y0/arcgis/rest/services/elevation_suisse/ImageServer';

// FEATURE LAYER NAMES (resolved to IDs at runtime via LayerIdResolver)
export const DOCUMENTS_LAYER_NAME = 'd_object_document';
export const REF_POINT_LAYER_NAME = 'referenzpunkt';
export const STATUS_LAYER_NAME = 'zustand';

// PORTAL CATEGORIES
export const RIMA_ROOT_CATEGORY = 'ROOT';

// REFERENCE POINT SCHEMA
export const REF_POINT_TYPE_FIELD = 'punkt_type';
