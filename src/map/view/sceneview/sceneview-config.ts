import { RIMA_BASEMAP_LAYER_ID, RIMA_ELEVATION_SERVICE_URL, RIMA_SCENEVIEW_WMS_URL } from '../../map-config';

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
    wmsUrl: RIMA_SCENEVIEW_WMS_URL,
    sublayer: RIMA_BASEMAP_LAYER_ID,
    title: 'Swisstopo Pixelkarte',
  },
  elevation: {
    url: RIMA_ELEVATION_SERVICE_URL,
  },
};

export const RIMA_SCENEVIEW_3D_CATEGORY = '3D';
