h1. Web Client Content Catalog

_Task:_ 644
_Branch:_ feature/579-table*of_contents
\_Date:* August 2026

---

h2. Executive Summary

The Content Catalog loads Web Map items from the FEDRO ArcGIS Portal, parses their layer definitions from the raw JSON, and adds the resulting ArcGIS SDK layers directly to the map. Each Web Map is optionally wrapped as a {{GroupLayer}} to preserve its identity in the layer tree. There is no intermediate catalog data model or store — the map's live layer collection _is_ the catalog, and the {{arcgis-layer-list}} widget reads it directly to render the Table of Contents sidebar.

---

h2. Overview

The content catalog pipeline is implemented inside {{MapViewInitService.loadWebMapLayers()}}. It queries the Portal for Web Map items matching the active language, fetches each item's raw JSON, parses the JSON into ArcGIS SDK layers via {{LayerService}}, and adds them to the map. No intermediate catalog store or data model exists — the ArcGIS {{Map.layers}} collection serves as the single source of truth.

The pipeline runs once during application startup, after the {{MapView}} is ready.

---

h2. Layer Types

{{LayerService}} parses the Web Map specification JSON and creates ArcGIS SDK layers for the following {{layerType}} values:

||Web Map JSON {{layerType}}||ArcGIS SDK Layer||
|{{ArcGISFeatureLayer}}|{{FeatureLayer}}|
|{{GroupLayer}}|{{GroupLayer}} (children parsed recursively)|
|{{WMS}}|{{WMSLayer}}|
|{{WebTiledLayer}}|{{WMTSLayer}} (uses {{wmtsInfo.url}} and {{wmtsInfo.layerIdentifier}})|

Entries with an unrecognised {{layerType}} or a missing {{url}} are silently skipped. All {{FeatureLayer}} instances receive {{outFields: ['*']}} and {{fullExtent}} set to the Switzerland extent (LV95).

---

h2. Build Process

The pipeline is orchestrated by {{MapViewInitService}} during {{init()}}:

h3. Step 1 — Resolve Language Category

{{resolveLanguageCategory()}} reads the active language from {{LanguageStore}} and looks up the Portal category identifier from {{language-info-config.ts}}:

||Language Code||Portal Category (catalogId)||
|{{de}}|{{FC}}|
|{{fr}}|{{FR}}|
|{{it}}|{{IT}}|

If no mapping exists, a {{MapViewLanguageCategoryMissingError}} (fatal) is thrown.

h3. Step 2 — Query Portal for Web Map Items

A {{PortalQueryParams}} is built with:

{code}
categories: ['/Categories/<catalogId>']
query: 'type:"Web Map"'
num: 100
sortField: 'title'
sortOrder: 'asc'
{code}

{{PortalService.queryItems()}} loads the Portal (with {{authMode: 'immediate'}}), executes the query, and returns a {{PortalItem[]}}. The Portal instance is cached to avoid repeated loads.

h3. Step 3 — Fetch and Parse Each Web Map

All items are processed in parallel via {{Promise.all()}}. For each {{PortalItem}}:

# {{item.fetchData('json')}} retrieves the raw Web Map specification JSON ({{WebmapDataJson}}).

# {{LayerService.parseWebmapJsonToLayers(data)}} walks the {{operationalLayers}} array and creates the corresponding ArcGIS SDK layers (see _Layer Types_ above). Group layers are parsed recursively.

# If {{RIMA_MAPVIEW_WRAP_WEBMAP_AS_GROUP}} is {{true}} (current default), the layers are wrapped in a {{GroupLayer}} titled after the Portal item.

# If the item's categories contain the segment {{HIDDEN}}, the group is set to {{visible: false}} and {{listMode: 'hide'}}, which excludes it from the Table of Contents.

h3. Step 4 — Add to Map

The resulting layer arrays are flattened and reversed (so the first portal item appears on top in the layer stack). {{MapViewInitService}} then calls {{view.map.addMany(layers)}}. The {{arcgis-layer-list}} widget in {{TocComponent}} automatically reflects the new layer hierarchy.

---

h2. Relationship to Other Components

||Consumer||Role||
|{{MapViewInitService}}|Orchestrates the full pipeline: query, fetch, parse, add to map.|
|{{PortalService}}|Loads and caches the ArcGIS {{Portal}} instance. Executes item queries.|
|{{LayerService}}|Parses {{WebmapDataJson}} into ArcGIS SDK {{Layer[]}}. Stateless; no store dependency.|
|{{LanguageStore}}|Provides the active language signal used to resolve the Portal category.|
|{{TocComponent}}|Reads the map's layer collection via the {{arcgis-layer-list}} widget. See [Table of Contents|../579-table_of_contents/table-of-contents.md].|
|{{ViewService}}|Receives the {{MapView}} reference after init. Transfers layers between map and scene views on mode switch.|

---

h2. Configuration

Constants in {{mapview-config.ts}} control content catalog behaviour:

||Constant||Current Value||Effect||
|{{RIMA_MAPVIEW_WRAP_WEBMAP_AS_GROUP}}|{{true}}|Each Web Map's layers are wrapped in a {{GroupLayer}} titled after the Portal item.|
|{{RIMA_MAPVIEW_HIDDEN_CATEGORY}}|{{'HIDDEN'}}|Portal items whose categories include this segment are hidden from the layer list.|
|{{RIMA_MAPVIEW_BASEMAP_WMTS_URL}}|Swisstopo WMTS capabilities URL|URL for the basemap WMTS service.|
|{{RIMA_MAPVIEW_BASEMAP_LAYER_ID}}|{{ch.swisstopo.pixelkarte-farbe}}|Active sublayer for the Swisstopo basemap.|
