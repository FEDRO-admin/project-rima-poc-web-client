import { LoadingState } from '../../loading-state';

// ── Webmap types (parsed from portal WebMap items) ──

export type WebmapLayerType = 'GroupLayer' | 'ArcGISFeatureLayer' | 'ArcGISMapServiceLayer' | 'WebTiledLayer';

export type WebmapLeafLayerType = Exclude<WebmapLayerType, 'GroupLayer'>;

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

export interface WebmapData {
  readonly title: string;
  readonly portalItemId: string;
  readonly categorySegments: string[];
  readonly layers: WebmapLayer[];
}

export interface WebmapCollection {
  loadState: LoadingState;
  readonly webmaps: WebmapData[];
}

// ── Catalog types (structured tree built from webmaps) ──

export type CatalogItemType = 'section' | 'feature-layer' | 'map-image-layer' | 'web-tiled-layer' | 'document';
export type CatalogSectionOrigin = 'category' | 'webmap' | 'group-layer';

interface BaseCatalog {
  loadState: LoadingState;
}

interface BaseCatalogItem extends BaseCatalog {
  readonly id: string;
  readonly title: string;
  readonly type: CatalogItemType;
  visible: boolean;
  items: CatalogItem[] | undefined;
}

export interface Catalog extends BaseCatalog {
  items: CatalogItem[];
}

export interface CatalogSection extends BaseCatalogItem {
  readonly type: 'section';
  readonly origin: CatalogSectionOrigin;
  items: CatalogItem[];
}

interface BaseCatalogLayer extends BaseCatalogItem {
  readonly webMapItemId: string;
  readonly layerId: string;
  readonly url: string;
  readonly items: undefined;
}

export interface CatalogFeatureLayer extends BaseCatalogLayer {
  readonly type: 'feature-layer';
}

export interface CatalogMapImageLayer extends BaseCatalogLayer {
  readonly type: 'map-image-layer';
}

export interface CatalogWebTiledLayer extends BaseCatalogLayer {
  readonly type: 'web-tiled-layer';
  readonly wmtsLayerIdentifier?: string;
}

export type CatalogLayer = CatalogFeatureLayer | CatalogMapImageLayer | CatalogWebTiledLayer;

export interface CatalogDocument extends BaseCatalogItem {
  readonly type: 'document';
  readonly url: string;
  readonly documentId: string;
  readonly items: undefined;
}

export type CatalogItem = CatalogSection | CatalogLayer | CatalogDocument;

export interface CatalogPathSegment {
  id: string;
  title: string;
  origin: CatalogSectionOrigin;
}

export interface CatalogLeafEntry {
  path: CatalogPathSegment[];
  leaf: CatalogLayer;
}
