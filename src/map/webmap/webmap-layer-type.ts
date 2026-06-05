export type WebmapLayerType = 'GroupLayer' | 'ArcGISFeatureLayer' | 'ArcGISMapServiceLayer' | 'WebTiledLayer';

export type WebmapLeafLayerType = Exclude<WebmapLayerType, 'GroupLayer'>;
