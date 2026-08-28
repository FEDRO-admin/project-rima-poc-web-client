import Extent from '@arcgis/core/geometry/Extent';

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
