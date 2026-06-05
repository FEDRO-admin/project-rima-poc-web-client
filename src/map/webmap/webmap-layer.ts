import { LoadingState } from '../loading-state';
import { WebmapLayerType } from './webmap-layer-type';

interface BaseWebmapLayer {
  readonly id: string;
  readonly title: string;
  readonly type: WebmapLayerType;
  readonly layerId: string;
  readonly layers: WebmapLayer[] | undefined;
  visible: boolean;
  loadState: LoadingState;
}

export interface WebmapGroupLayer extends BaseWebmapLayer {
  readonly type: 'GroupLayer';
  readonly layers: WebmapLayer[];
}

export interface WebmapFeatureLayer extends BaseWebmapLayer {
  readonly type: 'ArcGISFeatureLayer';
  readonly url: string;
}

export interface WebmapMapServiceLayer extends BaseWebmapLayer {
  readonly type: 'ArcGISMapServiceLayer';
  readonly url: string;
}

export interface WebmapWebTiledLayer extends BaseWebmapLayer {
  readonly type: 'WebTiledLayer';
  readonly url: string;
  readonly wmtsLayerIdentifier?: string;
}

export type WebmapLayer = WebmapGroupLayer | WebmapFeatureLayer | WebmapMapServiceLayer | WebmapWebTiledLayer;
