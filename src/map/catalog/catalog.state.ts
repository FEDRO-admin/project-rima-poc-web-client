import { LoadingState } from '../loading-state';
import { Catalog } from './catalog-types';

export interface CatalogState {
  catalog: Catalog | undefined;
  loadState: LoadingState;
}

export const initialCatalogState = {
  catalog: undefined,
  loadState: undefined,
} as const satisfies CatalogState;
