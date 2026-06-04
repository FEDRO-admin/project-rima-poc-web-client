import { Catalog, LoadingState } from './catalog-types';

export interface CatalogState {
  catalog: Catalog | undefined;
  loadState: LoadingState;
}

export const initialCatalogState = {
  catalog: undefined,
  loadState: undefined,
} as const satisfies CatalogState;
