import { withImmutableState } from '@angular-architects/ngrx-toolkit';
import { patchState, signalStore, withMethods } from '@ngrx/signals';
import { Catalog, LoadingState } from './catalog-types';
import { CatalogState, initialCatalogState } from './catalog.state';

export const CatalogStore = signalStore(
  { providedIn: 'root' },
  withImmutableState<CatalogState>(() => initialCatalogState),
  withMethods((store) => ({
    setCatalog(catalog: Catalog | undefined): void {
      patchState(store, { catalog });
    },
    setLoadState(loadState: LoadingState): void {
      patchState(store, { loadState });
    },
  })),
);
