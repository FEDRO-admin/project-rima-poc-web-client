# RIMA PoC – Application Documentation

---

## Application Startup

**Branch:** main  
**Date:** May 2026

The application starts by bootstrapping `AppComponent` with a set of globally registered providers. This process is entirely synchronous and completes before any route is activated.

As part of this bootstrap, an `AppEffectsService` is eagerly constructed via `provideAppInitializer()`. Its sole responsibility is to instantiate `LanguageEffect`, which registers a reactive side effect that keeps Transloco in sync with the active language stored in `LanguageStore`. On first run, this triggers an asynchronous HTTP request to load the default German translation file (`/i18n/de.json`); this load proceeds in the background and does not block the rest of startup.

Once the shell renders, the router immediately activates the default route and lazily loads `MapComponent`. Its constructor registers a reactive effect on the `<arcgis-map>` custom element reference. As soon as Angular resolves that element in the DOM, the effect fires and the following steps execute in strict order:

1. **MapView registration** — the ArcGIS `MapView` instance provided by the web component is stored in `MapViewService` as a signal. Any component watching this signal is notified immediately (see TOC section below).
2. **Basemap setup** — a `WMTSLayer` pointing to the Swisstopo Pixelkarte (`wmts.geo.admin.ch`) is assigned as the map basemap synchronously. The ArcGIS SDK loads the WMTS capabilities document in the background.
3. **Map readiness** — execution waits for `view.when()`, which resolves once the ArcGIS `MapView` has completed its internal initialisation.
4. **Catalog build** — `CatalogService.buildMapCatalog()` queries the ArcGIS Enterprise Portal for all Web Map items belonging to the active language category. Each Web Map is loaded in parallel, its layers are filtered to the permitted types (`ArcGISFeatureLayer` and `WebTiledLayer`), and the results are assembled into a hierarchical `Catalog` tree. The `CatalogStore` tracks the load state (`'loading'` → `'loaded'`) throughout this process.
5. **Layer addition** — `LayerService.addCatalogToMap()` traverses the catalog tree and creates the corresponding ArcGIS SDK layer objects (`FeatureLayer`, `WMTSLayer`, `GroupLayer`), then adds them all to the map in a single call. The ArcGIS SDK handles subsequent data loading asynchronously.

At the end of step 5 the map is fully operational and visible to the user.

---

## Table of Contents (ToC)

**Branch:** feature/579-table_of_contents  
**Date:** June 2026

The Table of Contents is implemented by `TocComponent`, which wraps the ArcGIS `arcgis-layer-list` web component (`<arcgis-layer-list>`).

### Initialisation

`TocComponent` is rendered as part of `MapComponent`'s template and is therefore present in the DOM from the moment the map route activates. However, the `arcgis-layer-list` element requires a `MapView` reference before it can display anything. The component handles this through a reactive Angular `effect()` that watches the `MapViewService.mapView()` signal. As soon as step 1 of the startup sequence above completes (MapView registration), this effect fires and assigns the view to the list element:

```
layerList.view = mapView
layerList.listItemCreatedFunction = fn
```

The `listItemCreatedFunction` callback is invoked once per layer entry as the list builds itself. For each `FeatureLayer` or `WMTSLayer` entry it attaches a _Zoom to_ action button in the layer's action section.

### Zoom to Layer

When a user clicks the _Zoom to_ button on a layer entry, `TocComponent.onTriggerAction()` is called. It reads the current `MapView` from the signal, ensures the layer is fully loaded by awaiting `layer.load()`, and then calls `view.goTo()` with the layer's spatial extent. For WMTS layers, which expose their extent via `layer.activeLayer.fullExtent` rather than `layer.fullExtent` directly, a fallback path is used.

# Application Flow

![RIMA_PoC_Startup_and_ToC](img/20260610_RIMA_PoC_Startup_and_ToC.png)
