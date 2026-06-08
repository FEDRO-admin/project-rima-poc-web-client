import { CatalogSectionOrigin } from './catalog-types';

export interface CatalogPathSegment {
  id: string;
  title: string;
  origin: CatalogSectionOrigin;
}
