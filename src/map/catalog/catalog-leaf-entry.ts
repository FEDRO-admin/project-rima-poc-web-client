import { CatalogLayer } from './catalog-types';
import { CatalogPathSegment } from './catalog-path-segment';

export interface CatalogLeafEntry {
  path: CatalogPathSegment[];
  leaf: CatalogLayer;
}
