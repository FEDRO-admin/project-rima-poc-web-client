# Web Client Content Catalog

**Task:** 644  
**Branch:** feature/580-signalstore
**Date:** June 2026

---

## Overview

The Content Catalog is the application's internal representation of the layer hierarchy. It transforms the flat list of Portal Web Map items (each containing arbitrarily nested layers) into a unified, navigable tree structure. This tree drives both the map's operational layers and the Table of Contents UI.

The catalog is built once during application startup (after the MapView is ready) and is stored in the `CatalogStore` for reactive access throughout the application.

---

## Data Model

The catalog is defined as a recursive tree with the following types:

### Catalog (root)

```
Catalog {
  loadState: 'loading' | 'loaded' | 'error' | undefined
  items: CatalogItem[]
}
```

The root `Catalog` holds a flat array of top-level items and tracks its own load state.

### CatalogItem (union type)

Every node in the tree is one of:

| Type                   | Description                                                                                                                                                     |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CatalogSection`       | A grouping node (folder) that contains child items. Has an `origin` indicating whether it was derived from a portal category, a webmap title, or a group layer. |
| `CatalogFeatureLayer`  | A leaf node representing an ArcGIS FeatureLayer.                                                                                                                |
| `CatalogMapImageLayer` | A leaf node representing an ArcGIS MapImageLayer.                                                                                                               |
| `CatalogWebTiledLayer` | A leaf node representing a WMTS layer.                                                                                                                          |
| `CatalogDocument`      | A leaf node representing a non-spatial document link.                                                                                                           |

### CatalogSection

```
CatalogSection {
  id: string
  title: string
  type: 'section'
  origin: 'category' | 'webmap' | 'group-layer'
  items: CatalogItem[]
  visible: boolean
  loadState: LoadingState
}
```

The `origin` field distinguishes how the section was created:

- `'category'` — derived from a Portal category path segment (e.g., a thematic grouping configured in the Portal).
- `'webmap'` — derived from the Web Map item title (used only when `RIMA_CATALOG_WEBMAP_NAME_AS_SECTION` is enabled).
- `'group-layer'` — derived from a GroupLayer within a Web Map.

### Catalog Layer (leaf nodes)

All layer types share a base structure:

```
BaseCatalogLayer {
  id: string               // e.g., "layer:{webMapItemId}/{layerId}"
  title: string
  type: CatalogItemType
  webMapItemId: string     // Portal item ID of the source Web Map
  layerId: string          // layer ID within that Web Map
  url: string              // service endpoint URL
  visible: boolean
  loadState: LoadingState
  items: undefined         // leaf nodes have no children
}
```

`CatalogWebTiledLayer` additionally carries a `wmtsLayerIdentifier` field used to select the active sublayer within a WMTS service.

---

## Build Process

The catalog is built by `CatalogService.buildMapCatalog()`, which orchestrates the following pipeline:

### Step 1 — Acquire the WebmapCollection

`WebmapService.getWebmapCollection()` queries the ArcGIS Enterprise Portal for all Web Map items belonging to the active language's category. The Portal uses a root-level category to distinguish content by language — for example, all German-language Web Maps are placed under `/Categories/DE/...`. The mapping between application language codes and Portal category names is defined in `src/i18n/language-info-config.ts`:

| Language Code | Portal Category |
| ------------- | --------------- |
| `de`          | `DE`            |
| `fr`          | `FR`            |
| `it`          | `IT`            |

The query targets all items of type `"Web Map"` within the resolved category (e.g., `"/Categories/DE"` for German). Each Web Map is loaded via the ArcGIS SDK, and its layers are extracted, filtered to the permitted types (`ArcGISFeatureLayer` and `WebTiledLayer`), and transformed into `WebmapData` objects. The result is a `WebmapCollection` containing an array of `WebmapData`, each with:

- `portalItemId` — the Portal item identifier
- `title` — the Web Map's display title
- `categorySegments` — the category path split into segments (e.g., `["Roads", "National"]`)
- `layers` — a recursive tree of `WebmapLayer` objects

### Step 2 — Collect Leaf Entries

`CatalogService.collectLeafEntries()` flattens the nested webmap layer trees into a list of `CatalogLeafEntry` objects. Each entry pairs a leaf layer with its full path through the hierarchy:

```
CatalogLeafEntry {
  path: CatalogPathSegment[]   // the folder path (category -> [webmap?] -> group -> ...)
  leaf: CatalogLayer           // the actual layer node
}
```

The path is constructed by concatenating:

1. **Category segments** — each segment from `webmapData.categorySegments` becomes a path segment with origin `'category'`.
2. **Webmap title** (optional) — if `RIMA_CATALOG_WEBMAP_NAME_AS_SECTION` is enabled, the Web Map title is appended with origin `'webmap'`. Currently this is disabled.
3. **Group layers** — if the layer is nested inside a `GroupLayer`, each group becomes a path segment with origin `'group-layer'`.

Web Maps are sorted by category path and title before processing, ensuring deterministic ordering in the final tree.

### Step 3 — Deposit at Path (tree assembly)

`CatalogService.depositAtPath()` walks the path segments for each leaf entry and builds the tree:

- For each segment in the path, it finds or creates a `CatalogSection` with a matching `id`.
- Once all segments are traversed, the leaf layer is placed in the deepest section's `items` array.

This "deposit" approach ensures that multiple webmaps sharing the same category path contribute their layers into the same section nodes, producing a merged tree rather than isolated subtrees per webmap.

### Step 4 — Store and Notify

The completed `Catalog` is stored in `CatalogStore` via `setCatalog()`, which sets both the catalog data and the load state to `'loaded'`. The catalog is then returned to `MapComponent`, which passes it to `LayerService.addCatalogToMap()` for rendering on the map.

---

## State Management

The `CatalogStore` is an NgRx SignalStore with immutable state:

```
CatalogState {
  catalog: Catalog | undefined
  loadState: LoadingState
}
```

It provides two methods:

- `setCatalog(catalog)` — sets the catalog and transitions load state to `'loaded'`. Throws `CatalogUndefinedError` if `undefined` is passed.
- `setLoadState(loadState)` — manually sets the load state (used for `'loading'` and `'error'` transitions).

---

## Relationship to Other Components

| Consumer       | How it uses the Catalog                                                                                                                       |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `LayerService` | Traverses `Catalog.items` recursively to build ArcGIS SDK layer objects (`GroupLayer`, `FeatureLayer`, `WMTSLayer`) and adds them to the map. |
| `TocComponent` | Indirectly — the ArcGIS `arcgis-layer-list` widget reads the map's layer collection, which mirrors the catalog structure.                     |
| `CatalogStore` | Holds the catalog as reactive state; could be consumed by future components needing catalog metadata (e.g., search, filtering).               |

---

## Configuration

Two constants in `map-constants.ts` control catalog behaviour:

| Constant                              | Current Value                             | Effect                                                                                        |
| ------------------------------------- | ----------------------------------------- | --------------------------------------------------------------------------------------------- |
| `RIMA_CATALOG_INCLUDED_LAYER_TYPES`   | `['ArcGISFeatureLayer', 'WebTiledLayer']` | Only these layer types are extracted from Web Maps. `ArcGISMapServiceLayer` is commented out. |
| `RIMA_CATALOG_WEBMAP_NAME_AS_SECTION` | `false`                                   | When `true`, each Web Map's title appears as an additional section level in the catalog tree. |
