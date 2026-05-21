export type CatalogItemType = 'section' | 'feature-layer' | 'map-image-layer' | 'web-tiled-layer' | 'document';
export type CatalogSectionOrigin = 'category' | 'webmap' | 'group-layer';

// BASE INTERFACES
export interface BaseCatalog {
  loading: boolean;
  error: unknown | null;
}

export interface BaseCatalogItem extends BaseCatalog {
  readonly id: string;
  readonly title: string;
  readonly type: CatalogItemType;
  visible: boolean;
  items: CatalogItem[] | undefined;
}

// CATALOG PARSING INTERFACES
export interface CatalogPathSegment {
  id: string;
  title: string;
  origin: CatalogSectionOrigin;
}

export interface CatalogLeafEntry {
  path: CatalogPathSegment[];
  leaf: CatalogLayer;
}

// CATALOG-SPECIFIC INTERFACES
export interface Catalog extends BaseCatalog {
  items: CatalogItem[];
}

export interface CatalogSection extends BaseCatalogItem {
  readonly type: 'section';
  readonly origin: CatalogSectionOrigin;
  items: CatalogItem[];
}

// CATALOG LAYER DISCRIMINATED UNION
export interface BaseCatalogLayer extends BaseCatalogItem {
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
