import { DOCUMENTS_LAYER_NAME, DOCUMENTS_MAP_LAYER_TITLE } from '../../map-config';

export { DOCUMENTS_LAYER_NAME, DOCUMENTS_MAP_LAYER_TITLE };

// Fields set programmatically by the service — excluded from the edit form
export const DOCUMENT_AUTO_POPULATED_FIELDS: readonly string[] = [
  'id',
  'fk_parent',
  'parent_class_name',
  'pfad',
  'name',
  'groesse',
  'autor',
  'letzte_aenderung',
  'anzahl_seiten',
];

/** Portal folder name where uploaded documents are stored. */
export const DOCUMENTS_PORTAL_FOLDER = 'rima-documents';

/** Document types that can be viewed directly in the browser. */
export const DOCUMENTS_VIEWABLE_TYPES = ['pdf', 'png'];

/** Maximum allowed file size for upload (in megabytes). */
export const DOCUMENTS_MAX_FILE_SIZE_MB = 50;

/**
 * Base URL for the document REST API.
 * Currently unused — documents are uploaded to the ESRI Portal.
 * Set this when the custom backend is ready.
 */
export const DOCUMENTS_API_BASE_URL = '';

/**
 * Maps file extensions to ArcGIS Portal item types.
 * Only extensions with unambiguous type mappings are listed.
 * Extensions using .zip are excluded (ambiguous: Shapefile, CAD, File Geodatabase, etc.).
 * Extensions using .json are excluded (ambiguous: GeoJSON, Mission Report, Web Experience, etc.).
 * Source: https://doc.esri.com/en/arcgis-enterprise/latest/share/supported-items.html
 */
export const DOCUMENTS_PORTAL_TYPE_MAP: Record<string, string> = {
  // Documents
  pdf: 'PDF',
  doc: 'Microsoft Word',
  docx: 'Microsoft Word',
  xls: 'Microsoft Excel',
  xlsx: 'Microsoft Excel',
  ppt: 'Microsoft Powerpoint',
  pptx: 'Microsoft Powerpoint',
  vsd: 'Microsoft Visio',
  key: 'iWork Keynote',
  numbers: 'iWork Numbers',
  pages: 'iWork Pages',
  // Images
  jpg: 'Image',
  jpeg: 'Image',
  png: 'Image',
  tif: 'Image',
  tiff: 'Image',
  // Data formats
  csv: 'CSV',
  geojson: 'GeoJson',
  kml: 'KML',
  kmz: 'KML',
  gpkg: 'GeoPackage',
  parquet: 'Apache Parquet',
  // GIS packages
  mpk: 'Map Package',
  mpkx: 'Map Package',
  lpk: 'Layer Package',
  lpkx: 'Layer Package',
  mmpk: 'Mobile Map Package',
  mspk: 'Mobile Scene Package',
  bpk: 'Mobile Basemap Package',
  spk: 'Scene Package',
  slpk: 'Scene Package',
  tpk: 'Tile Package',
  tpkx: 'Tile Package',
  vtpk: 'Vector Tile Package',
  gpk: 'Geoprocessing Package',
  gcpk: 'Locator Package',
  ppkx: 'Project Package',
  aptx: 'Project Template',
  rpk: 'Rule Package',
  sd: 'Service Definition',
  dlpk: 'Deep Learning Package',
  epk: 'Export Package',
  // ArcGIS Pro formats
  mapx: 'Pro Map',
  pagx: 'Layout',
  lyrx: 'Layer',
  lyr: 'Layer File',
  stylx: 'Desktop Style',
  esriaddinx: 'ArcGIS Pro Add In',
  // Other supported formats
  '3tz': '3D Tiles Package',
  '3vr': '360 VR Experience',
  ipynb: 'Notebook',
  oic: 'Oriented Imagery Catalog',
  ecd: 'Esri Classifier Definition',
  pmf: 'ArcReader Document',
  sxd: 'ArcScene Document',
  '3dd': 'ArcGlobe Document',
  msd: 'Map Service Definition',
  surveyaddin: 'Survey123 Add In',
  wmpk: 'Windows Mobile Package',
};
