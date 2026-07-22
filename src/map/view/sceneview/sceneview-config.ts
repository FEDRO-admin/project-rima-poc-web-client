export interface SceneBasemapConfig {
  wmsUrl: string;
  sublayer: string;
  title: string;
}

export interface SceneElevationConfig {
  url: string | undefined;
}

export interface SceneConfig {
  basemap: SceneBasemapConfig;
  elevation: SceneElevationConfig;
}

export const RIMA_SCENEVIEW_CONFIG: SceneConfig = {
  basemap: {
    wmsUrl: 'https://wms.geo.admin.ch/',
    sublayer: 'ch.swisstopo.pixelkarte-farbe',
    title: 'Swisstopo Pixelkarte',
  },
  elevation: {
    url: 'https://tiles.arcgis.com/tiles/oPre3pOfRfefL8y0/arcgis/rest/services/elevation_suisse/ImageServer',
  },
};

export const RIMA_SCENEVIEW_3D_CATEGORY = '3D';
