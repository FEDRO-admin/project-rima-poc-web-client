# Application Startup

**Task:** 604  
**Branch:** main  
**Date:** May 2026

---

The application starts by bootstrapping `AppComponent` with a set of globally registered providers. This process is entirely synchronous and completes before any route is activated.

As part of this bootstrap, an `AppEffectsService` is eagerly constructed via `provideAppInitializer()`. Its sole responsibility is to instantiate `LanguageEffect`, which registers a reactive side effect that keeps Transloco in sync with the active language stored in `LanguageStore`. On first run, this triggers an asynchronous HTTP request to load the default German translation file (`/i18n/de.json`); this load proceeds in the background and does not block the rest of startup.

Once the shell renders, the router immediately activates the default route and lazily loads `MapComponent`. Its constructor registers a reactive effect on the `<arcgis-map>` custom element reference. As soon as Angular resolves that element in the DOM, the effect fires and the following steps execute in strict order:

1. **MapView registration** — the ArcGIS `MapView` instance provided by the web component is stored in `MapViewService` as a signal. Any component watching this signal is notified immediately (see [Table of Contents](../579-table_of_contents/table-of-contents.md)).
2. **Basemap setup** — a `WMTSLayer` pointing to the Swisstopo Pixelkarte (`wmts.geo.admin.ch`) is assigned as the map basemap synchronously. The ArcGIS SDK loads the WMTS capabilities document in the background.
3. **Map readiness** — execution waits for `view.when()`, which resolves once the ArcGIS `MapView` has completed its internal initialisation.
4. **Catalog build** — `CatalogService.buildMapCatalog()` queries the ArcGIS Enterprise Portal for all Web Map items belonging to the active language category. Each Web Map is loaded in parallel, its layers are filtered to the permitted types (`ArcGISFeatureLayer` and `WebTiledLayer`), and the results are assembled into a hierarchical `Catalog` tree. The `CatalogStore` tracks the load state (`'loading'` → `'loaded'`) throughout this process.
5. **Layer addition** — `LayerService.addCatalogToMap()` traverses the catalog tree and creates the corresponding ArcGIS SDK layer objects (`FeatureLayer`, `WMTSLayer`, `GroupLayer`), then adds them all to the map in a single call. The ArcGIS SDK handles subsequent data loading asynchronously.

At the end of step 5 the map is fully operational and visible to the user.
