import { RIMA_ELEVATION_SERVICE_URL } from '../../map-config';

export interface SceneElevationConfig {
  url: string | undefined;
}

export interface SceneConfig {
  elevation: SceneElevationConfig;
}

export const RIMA_SCENEVIEW_CONFIG: SceneConfig = {
  elevation: {
    url: RIMA_ELEVATION_SERVICE_URL,
  },
};

export const RIMA_SCENEVIEW_HIDDEN_CATEGORY = 'HIDDEN';
