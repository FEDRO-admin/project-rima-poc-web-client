h1. Web Client Content Catalog

_Task:_ 644
_Branch:_ feature/585-3D_view
_Date:_ July 2026

---

h2. Executive Summary

The Content Catalog transforms raw Web Map data from the FEDRO ArcGIS Portal into a structured, navigable layer tree. This tree determines both which layers appear on the map and how they are grouped in the Table of Contents sidebar. The catalog is built once at startup for the active language and drives the entire layer structure visible to the user.

---

h2. Overview

The Content Catalog is the application's internal representation of the layer hierarchy. It transforms the flat list of Portal Web Map items (each containing arbitrarily nested layers) into a unified, navigable tree structure. This tree drives both the map's operational layers and the Table of Contents UI.

The catalog is built once during application startup (after the MapView is ready) and is stored in the {{CatalogStore}} for reactive access throughout the application.

---

h2. Data Model

The catalog is defined as a recursive tree with the following types:

h3. Catalog (root)

{code}
Catalog {
loadState: 'loading' | 'loaded' | 'error' | undefined
items: CatalogItem[]
}
{code}

The root {{Catalog}} holds a flat array of top-level items and tracks its own load state.

h3. CatalogItem (union type)

Every node in the tree is one of:

||Type||Description||
|{{CatalogSection}}|A grouping node (folder) that contains child items. Has an {{origin}} indicating whether it was derived from a portal category, a webmap title, or a group layer.|
|{{CatalogFeatureLayer}}|A leaf node representing an ArcGIS FeatureLayer.|
|{{CatalogMapImageLayer}}|A leaf node representing an ArcGIS MapImageLayer.|
|{{CatalogWebTiledLayer}}|A leaf node representing a WMTS layer.|
|{{CatalogDocument}}|A leaf node representing a non-spatial document link (with {{url}} and {{documentId}}).|

h3. CatalogSection

{code}
CatalogSection {
id: string
title: string
type: 'section'
origin: 'category' | 'webmap' | 'group-layer'
items: CatalogItem[]
visible: boolean
loadState: LoadingState
}
{code}

The {{origin}} field distinguishes how the section was created:

- {{'category'}} — derived from a Portal category path segment (e.g., a thematic grouping configured in the Portal).
- {{'webmap'}} — derived from the Web Map item title (used when {{RIMA_CATALOG_WEBMAP_NAME_AS_SECTION}} is enabled).
- {{'group-layer'}} — derived from a GroupLayer within a Web Map.

h3. Catalog Layer (leaf nodes)

All layer types share a base structure:

{code}
BaseCatalogLayer {
id: string // e.g., "layer:{webMapItemId}/{layerId}"
title: string
type: CatalogItemType
webMapItemId: string // Portal item ID of the source Web Map
layerId: string // layer ID within that Web Map
url: string // service endpoint URL
visible: boolean
loadState: LoadingState
items: undefined // leaf nodes have no children
}
{code}

{{CatalogWebTiledLayer}} additionally carries a {{wmtsLayerIdentifier}} field used to select the active sublayer within a WMTS service.

h3. CatalogDocument

{code}
CatalogDocument {
id: string
title: string
type: 'document'
url: string // link to the document resource
documentId: string // identifier for the document
visible: boolean
items: undefined // leaf node
}
{code}

Document nodes are present in the catalog tree but are skipped during layer creation (they do not produce an ArcGIS SDK layer).

---

h2. Build Process

The catalog is built by {{CatalogService.buildMapCatalog()}}, which orchestrates the following pipeline:

h3. Step 1 — Acquire the WebmapCollection

{{WebmapService.getWebmapCollection()}} queries the ArcGIS Enterprise Portal for all Web Map items belonging to the active language's category. The Portal uses a root-level category to distinguish content by language — for example, all German-language Web Maps are placed under {{/Categories/DE/...}}. The mapping between application language codes and Portal category names is defined in {{src/i18n/language-info-config.ts}}:

||Language Code||Portal Category||
|{{de}}|{{DE}}|
|{{fr}}|{{FR}}|
|{{it}}|{{IT}}|

The query targets all items of type "Web Map" within the resolved category (e.g., {{/Categories/DE}} for German). Each Web Map is loaded via the ArcGIS SDK, and its layers are extracted, filtered to the permitted types ({{ArcGISFeatureLayer}} and {{WebTiledLayer}}), and transformed into {{WebmapData}} objects. The result is a {{WebmapCollection}} containing an array of {{WebmapData}}, each with:

- {{portalItemId}} — the Portal item identifier
- {{title}} — the Web Map's display title
- {{categorySegments}} — the category path split into segments (e.g., {{\["Roads", "National"\]}})
- {{layers}} — a recursive tree of {{WebmapLayer}} objects

h3. Step 2 — Collect Leaf Entries

{{CatalogService.collectLeafEntries()}} flattens the nested webmap layer trees into a list of {{CatalogLeafEntry}} objects. Each entry pairs a leaf layer with its full path through the hierarchy:

{code}
CatalogLeafEntry {
path: CatalogPathSegment[] // the folder path (category -> [webmap?] -> group -> ...)
leaf: CatalogLayer // the actual layer node
}
{code}

The path is constructed by concatenating:

# _Category segments_ — each segment from {{webmapData.categorySegments}} becomes a path segment with origin {{'category'}}.

# _Webmap title_ — the Web Map title is appended with origin {{'webmap'}} (controlled by {{RIMA_CATALOG_WEBMAP_NAME_AS_SECTION}}, currently enabled).

# _Group layers_ — if the layer is nested inside a {{GroupLayer}}, each group becomes a path segment with origin {{'group-layer'}}.

Web Maps are sorted by category path and title before processing, ensuring deterministic ordering in the final tree.

h3. Step 3 — Deposit at Path (tree assembly)

{{CatalogService.depositAtPath()}} walks the path segments for each leaf entry and builds the tree:

- For each segment in the path, it finds or creates a {{CatalogSection}} with a matching {{id}}.
- Once all segments are traversed, the leaf layer is placed in the deepest section's {{items}} array.

This "deposit" approach ensures that multiple webmaps sharing the same category path contribute their layers into the same section nodes, producing a merged tree rather than isolated subtrees per webmap.

h3. Step 4 — Store and Notify

The completed {{Catalog}} is stored in {{CatalogStore}} via {{setCatalog()}}, which sets both the catalog data and the load state to {{'loaded'}}. The catalog is then returned to {{MapComponent}}, which passes it to {{LayerService.addCatalogToMap()}} for rendering on the map.

---

h2. State Management

The {{CatalogStore}} is an NgRx SignalStore with immutable state:

{code}
CatalogState {
catalog: Catalog | undefined
loadState: LoadingState
}
{code}

It provides two methods:

- {{setCatalog(catalog)}} — sets the catalog and transitions load state to {{'loaded'}}. Throws {{CatalogUndefinedError}} if {{undefined}} is passed.
- {{setLoadState(loadState)}} — manually sets the load state (used for {{'loading'}} and {{'error'}} transitions).

---

h2. Relationship to Other Components

||Consumer||How it uses the Catalog||
|{{LayerService}}|Traverses {{Catalog.items}} recursively to build ArcGIS SDK layer objects ({{GroupLayer}}, {{FeatureLayer}}, {{MapImageLayer}}, {{WMTSLayer}}) and adds them to the map. Items of type {{document}} are skipped.|
|{{TocComponent}}|Indirectly — the ArcGIS {{arcgis-layer-list}} widget reads the map's layer collection, which mirrors the catalog structure.|
|{{CatalogStore}}|Holds the catalog as reactive state; could be consumed by future components needing catalog metadata (e.g., search, filtering).|

---

h2. Configuration

Two constants in {{map-constants.ts}} control catalog behaviour:

||Constant||Current Value||Effect||
|{{RIMA_CATALOG_INCLUDED_LAYER_TYPES}}|{{'ArcGISFeatureLayer', 'WebTiledLayer'}}|Only these layer types are extracted from Web Maps. {{ArcGISMapServiceLayer}} is commented out.|
|{{RIMA_CATALOG_WEBMAP_NAME_AS_SECTION}}|{{true}}|Each Web Map's title appears as an additional section level in the catalog tree.|
