export type WebmapLayerType = 'GroupLayer' | 'ArcGISFeatureLayer' | 'ArcGISMapServiceLayer' | 'WebTiledLayer';

export interface WebmapCollection {
  loading: boolean;
  error: unknown | null;
  readonly webmaps: WebmapData[];
}

export interface WebmapData {
  readonly title: string;
  readonly portalItemId: string;
  readonly categories: string[];
  readonly layers: WebmapLayer[];
}

export interface BaseWebmapLayer {
  readonly id: string;
  readonly title: string;
  readonly type: WebmapLayerType;
  readonly layers: WebmapLayer[] | undefined;
  visible: boolean;
  loading: boolean;
  error: unknown | null;
}

export interface WebmapGroupLayer extends BaseWebmapLayer {
  readonly type: 'GroupLayer';
  readonly layerId: string;
  readonly layers: WebmapLayer[];
}

export interface WebmapFeatureLayer extends BaseWebmapLayer {
  readonly type: 'ArcGISFeatureLayer';
  readonly layerId: string;
  readonly url: string;
}

export interface WebmapMapServiceLayer extends BaseWebmapLayer {
  readonly type: 'ArcGISMapServiceLayer';
  readonly layerId: string;
  readonly url: string;
}

export interface WebmapWebTiledLayer extends BaseWebmapLayer {
  readonly type: 'WebTiledLayer';
  readonly layerId: string;
  readonly url: string;
  readonly wmtsLayerIdentifier?: string;
}

export interface RawWebmapLayer {
  id: string;
  title: string;
  layerType: string;
  url?: string;
  templateUrl?: string;
  visibility?: boolean;
  layers?: RawWebmapLayer[];
  wmtsInfo?: {
    url: string;
    layerIdentifier: string;
  };
}

export type WebmapLayer = WebmapGroupLayer | WebmapFeatureLayer | WebmapMapServiceLayer | WebmapWebTiledLayer;
