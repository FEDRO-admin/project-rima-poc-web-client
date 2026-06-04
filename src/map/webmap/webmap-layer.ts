import { LoadingState } from '../loading-state';
import { WebmapLayerType } from './webmap-layer-type';

interface BaseWebmapLayer {
  readonly id: string;
  readonly title: string;
  readonly type: WebmapLayerType;
  readonly layers: WebmapLayer[] | undefined;
  visible: boolean;
  loadState: LoadingState;
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

export type WebmapLayer = WebmapGroupLayer | WebmapFeatureLayer | WebmapMapServiceLayer | WebmapWebTiledLayer;
