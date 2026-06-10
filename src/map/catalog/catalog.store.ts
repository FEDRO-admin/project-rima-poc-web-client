import { withImmutableState } from '@angular-architects/ngrx-toolkit';
import { patchState, signalStore, withMethods } from '@ngrx/signals';
import { LoadingState } from '../loading-state';
import { Catalog } from './catalog-types';
import { CatalogState, initialCatalogState } from './catalog.state';
import { CatalogUndefinedError } from './catalog-errors';

export const CatalogStore = signalStore(
  { providedIn: 'root' },
  withImmutableState<CatalogState>(() => initialCatalogState),
  withMethods((store) => ({
    setCatalog(catalog: Catalog | undefined): void {
      if (catalog !== undefined) {
        patchState(store, { catalog });
        this.setLoadState('loaded');
      } else {
        throw new CatalogUndefinedError();
      }
    },
    setLoadState(loadState: LoadingState): void {
      patchState(store, { loadState });
    },
  })),
);
