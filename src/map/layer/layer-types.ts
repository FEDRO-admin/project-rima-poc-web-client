/**
 * Web map specification JSON `layerType` values.
 * @see https://developers.arcgis.com/web-map-specification/objects/operationalLayers/
 */

export const LAYER_TYPE_FEATURE = 'ArcGISFeatureLayer' as const;
export const LAYER_TYPE_GROUP = 'GroupLayer' as const;
export const LAYER_TYPE_WMS = 'WMS' as const;
export const LAYER_TYPE_WEB_TILED = 'WebTiledLayer' as const;

export const layerTypes = [LAYER_TYPE_FEATURE, LAYER_TYPE_GROUP, LAYER_TYPE_WMS, LAYER_TYPE_WEB_TILED] as const;
export type LayerType = (typeof layerTypes)[number];

interface LayerBase {
  id?: string;
  title?: string;
  url?: string;
  layerType: LayerType;
  visibility?: boolean;
  opacity?: number;
}

export interface FeatureLayerJson extends LayerBase {
  layerType: typeof LAYER_TYPE_FEATURE;
}

export interface GroupLayerJson extends LayerBase {
  layerType: typeof LAYER_TYPE_GROUP;
  layers?: WebmapOperationalLayerJson[];
}

export interface WmsLayerJson extends LayerBase {
  layerType: typeof LAYER_TYPE_WMS;
}

export interface WebTiledLayerJson extends LayerBase {
  layerType: typeof LAYER_TYPE_WEB_TILED;
  wmtsInfo?: {
    url: string;
    layerIdentifier: string;
    tileMatrixSet?: string;
  };
}

export type WebmapOperationalLayerJson =
  | FeatureLayerJson
  | GroupLayerJson
  | WmsLayerJson
  | WebTiledLayerJson
  | LayerBase;

export interface WebmapDataJson {
  operationalLayers?: WebmapOperationalLayerJson[];
}
