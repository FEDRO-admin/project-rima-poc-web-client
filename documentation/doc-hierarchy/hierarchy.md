h1. Data Hierarchy & Table of Contents — Architecture Options

_Date:_ July 2026

---

h2. Executive Summary

The RIMA web client needs a structured Table of Contents (ToC) to present a large number of geospatial datasets to users. The ToC hierarchy is built from data published on the FEDRO ArcGIS Portal. This document evaluates the different approaches for organising, publishing, and presenting layer data — from single monolithic Web Maps to multi-webmap category-based structures. Each approach is assessed for scalability, multilingual support, relationship integrity, and moderator flexibility. A recommended approach for production is provided.

---

h2. Context & Requirements

RIMA is a federal Web GIS for the Swiss Federal Roads Office (FEDRO / ASTRA) with the following requirements:

- _Large dataset count:_ Many Feature Layers across multiple domains (infrastructure, structures, reference points, etc.)
- _Multilingual:_ Content must be available in DE, FR, IT — each language may have different layer titles, labels, and category names
- _Role-based access:_ Different user roles may see different subsets of the data (future requirement)
- _Relationships:_ Layers have relationship classes that enable navigation between related features (e.g., Bauwerk → Bauwerksteil)
- _Moderator-managed:_ Non-developers (GIS moderators) should be able to reorganise the ToC without code changes
- _Scalable:_ The architecture must support growth from a PoC to hundreds of layers

---

h2. Current Implementation

The web client's catalog pipeline currently works as follows:

# _Language selection_ → determines the Portal category root ({{DE}}, {{FR}}, {{IT}})

# _Portal query_ → all Web Maps assigned to the category {{/Categories/<language>}} (and sub-categories) are fetched

# _Web Map loading_ → each Web Map is loaded via the ArcGIS JS SDK and its layers are extracted

# _Hierarchy construction_ → the ToC tree is assembled from three hierarchy sources:

## _Portal categories_ (path segments from the item's category assignment) → top-level sections

## _Web Map title_ (optionally) → mid-level section (controlled by {{RIMA_CATALOG_WEBMAP_NAME_AS_SECTION}})

## _Group Layers within the Web Map_ → nested sections

# _Leaf layers_ → Feature Layers, Map Image Layers, and WMTS layers become leaf entries in the tree

The code in {{CatalogService}} builds this tree by collecting leaf entries with their full path and then depositing each leaf at the correct position in the recursive tree structure.

{code}
ToC Hierarchy (current):
├── [Portal Category] (origin: 'category')
│ ├── [Web Map Title] (origin: 'webmap', optional)
│ │ ├── [Group Layer Name] (origin: 'group-layer')
│ │ │ ├── Feature Layer A
│ │ │ └── Feature Layer B
│ │ └── Feature Layer C
│ └── ...
└── ...
{code}

---

h2. Approaches Evaluated

h3. Approach 1: Single Large Web Map (All Data)

_Description:_ Publish one Web Map containing every layer, structured using Group Layers for the full hierarchy.

||Pros||Cons||
|Simple publishing — one map to maintain|Web Map becomes unwieldy with many layers|
|Relationships work natively (same service, same map)|Language switching requires a completely separate Web Map per language, duplicating the entire structure|
|Group Layers provide natural hierarchy|No moderator flexibility — hierarchy changes require ArcGIS Pro re-publishing|
|No cross-webmap relationship concerns|Portal category system unused — no way for moderators to restructure without editing the map|
||Hard limit on Web Map complexity (performance, load times)|
||Difficult to assign role-based access to subsets|

_Verdict:_ Works for small PoC but does not scale. Lacks moderator flexibility and multilingual agility.

---

h3. Approach 2: Multiple Small Web Maps (One Per Topic)

_Description:_ Publish many small Web Maps (e.g., one per domain: "Bauwerke", "Anlagen", "Bauwerksteile") and use Portal categories to structure the ToC.

||Pros||Cons||
|Granular publishing — each topic is independent|_Relationships cannot span Web Maps_ — a relationship query references a {{relatedTableId}} within the same service, but if the related layer is not in the same Web Map, the client may not have it loaded|
|Moderators can reorganise by re-categorising items|Portal categories are limited to 3 levels of depth|
|Language-specific Web Maps are small and manageable|More Portal items to manage|
|Role-based access: different categories per role|Layer duplication if the same layer appears in multiple contexts|
||Breaks feature relationship navigation across domains|

_Verdict:_ Good for organisation but _relationship integrity is lost_ when related layers live in different Web Maps. This was tested and confirmed — relationships cannot transcend Web Map boundaries in the client because the related layer is simply not loaded on the map.

---

h3. Approach 3: One Web Map Per Language + Group Layers (Current)

_Description:_ Publish one Web Map per language. Use Group Layers inside the Web Map to structure the hierarchy. Assign the Web Map to a language category.

||Pros||Cons||
|Relationships work (everything in one service/map)|Hierarchy is fixed at publish time — no moderator flexibility|
|Language switching is clean (different Web Map per language)|Group Layers provide limited hierarchy depth in practice|
|Simple client logic|Adding hierarchy levels requires re-publishing in ArcGIS Pro|
|Portal categories used for language root only|Loses granularity of Portal category system (only 1 level used: language)|
||One large Web Map can become hard to manage|

_Verdict:_ This is the current implementation. It guarantees relationship integrity but sacrifices moderator flexibility and category-based structuring.

---

h3. Approach 4: Publishing Web Map + Moderator-Curated Portal Web Maps (Proposed)

_Description:_

# Publish _one large "source" Web Map per language_ in ArcGIS Pro containing all layers from all services. This ensures all layers are published as services on ArcGIS Server.

# A _moderator_ then creates _individual smaller Web Maps_ on the ArcGIS Portal (via the Map Viewer) by referencing the already-published services.

# These curated Web Maps are assigned to _Portal categories_ to build the final ToC hierarchy.

# The web client queries the Portal for Web Maps in the active language's category tree, loads them, and assembles the ToC.

{code}
Publishing flow:
┌────────────────────────────────────────────────────────────┐
│ ArcGIS Pro │
│ → Publishes ONE large Web Map with all layers │
│ → All layers become services on ArcGIS Server │
└────────────────────────────────────────────────────────────┘
│
▼
┌────────────────────────────────────────────────────────────┐
│ ArcGIS Portal (Moderator) │
│ → Creates smaller Web Maps referencing existing services │
│ → Assigns Web Maps to categories (DE/Infrastructure/...) │
│ → Controls ToC structure without re-publishing │
└────────────────────────────────────────────────────────────┘
│
▼
┌────────────────────────────────────────────────────────────┐
│ Web Client │
│ → Queries Portal for Web Maps in language category │
│ → Loads each Web Map, extracts layers │
│ → Builds ToC from categories + webmap titles + groups │
└────────────────────────────────────────────────────────────┘
{code}

_Will relationships work across different moderator Web Maps?_

_Yes_ — with an important caveat. ArcGIS relationships are defined at the _FeatureService_ level, not the Web Map level. A relationship query ({{queryRelatedRecords}}) is sent directly to the FeatureService endpoint (e.g., {{FeatureServer/7/queryRelatedRecords}}). It returns related features based on the relationship class defined in the service. The response includes the {{relatedTableId}} which identifies the target layer _within the same service_.

This means:

- If all layers come from the _same FeatureService_, relationships work regardless of which Web Map the layers were added to
- The client must be able to locate the target layer (by service URL + layer ID) even if it's currently loaded from a different Web Map
- Cross-service relationships (layers from different FeatureServices) are NOT supported by the ArcGIS REST API regardless of approach

||Pros||Cons||
|_Relationships preserved_ — all layers share the same underlying service(s)|Requires moderator discipline to reference the correct services|
|_Moderator flexibility_ — ToC structure managed via Portal without ArcGIS Pro|Two-step publishing process (Pro → Portal)|
|_Portal categories_ used for deep hierarchy (up to 3 levels + webmap title + group layers = 5+ levels)|The "source" Web Map must still be maintained in ArcGIS Pro for schema changes|
|_Role-based access_ possible via category visibility or item sharing|Client must handle the case where a related layer exists in the service but is not in any loaded Web Map|
|_Language support_ — moderator can create language-specific curated maps|Moderator needs basic GIS knowledge to add layers from services|
|_Scalable_ — individual topic Web Maps are small and fast to load|Portal category depth limited to 3 levels (but combined with webmap title and group layers, total depth is 5+)|
|No re-publishing needed for hierarchy changes||

_Caveats:_

- The client's relationship navigation must resolve related features by _service URL and layer ID_, not by "which Web Map contains this layer". This may require the client to find the related layer across all loaded Web Maps or fetch it on demand.
- If a moderator forgets to include a related layer in any curated Web Map, the relationship will still technically work at the service level but the user won't have the target layer visible on the map.

_Verdict:_ This is the _recommended approach for production_. It combines the relationship integrity of a single-service architecture with the flexibility of Portal-managed hierarchy.

---

h3. Approach 5: ArcGIS SubtypeGroupLayers

_Description:_ Use the native ArcGIS Subtype Group Layer mechanism where the service manages subtype-to-sublayer mapping.

See [documentation/doc-subtypes/subtypes.md] for the full evaluation.

_Verdict:_ Not viable due to SDK limitations, missing subtype identity on empty layers, and relationship issues. Evaluated separately.

---

h2. Portal Categories — Constraints & Best Practices

ArcGIS Portal categories have the following constraints:

- _Maximum depth: 3 levels_ (e.g., {{/Categories/DE/Infrastruktur/Brücken}})
- Categories are assigned to _Portal items_ (Web Maps, Feature Services, etc.)
- An item can belong to _multiple categories_
- Categories are _organisation-wide_ — all users see the same category structure (access controlled via item sharing)

In the current implementation, category segments are extracted from a Web Map's category assignment and become the top levels of the ToC hierarchy:

{code}
Example category: /Categories/DE/Infrastruktur/Bauwerke
↓ ↓ ↓
ToC: [language] [level 1] [level 2]
{code}

Combined with webmap title (level 3) and group layers (level 4+), the effective hierarchy depth is:

{code}
Level 1: Portal category segment 1 (e.g., "Infrastruktur")
Level 2: Portal category segment 2 (e.g., "Bauwerke")
Level 3: Web Map title (e.g., "Übersicht Bauwerke")
Level 4: Group Layer (e.g., "Brücken")
Level 5: Feature Layer (e.g., "4A Brücken")
{code}

This provides 5 levels of hierarchy which should be sufficient for production.

---

h2. Relationship Integrity Across Approaches

||Approach||Relationships Work?||Reason||
|Single large Web Map|Yes|All layers in same service and same map|
|Multiple small Web Maps|_No_|Related layers may not be loaded if in a different Web Map|
|One Web Map per language + groups|Yes|All layers in same service and same map|
|Publishing WM + moderator curated WMs|_Yes (with caveats)_|All layers share the same FeatureService; relationship queries go to the service directly|
|SubtypeGroupLayers|Partial|Relationships collapse to master-layer level (see subtype doc)|

---

h2. Recommendation for Production

_Approach 4 (Publishing Web Map + Moderator-Curated Portal Web Maps)_ is recommended for the following reasons:

# _Relationship integrity_ — all layers originate from the same FeatureService(s), so relationship queries work regardless of which Web Map contains the layer

# _Moderator flexibility_ — GIS moderators can reorganise the ToC by creating/modifying Web Maps and assigning categories without re-publishing from ArcGIS Pro

# _Scalable hierarchy_ — combining Portal categories (3 levels) + Web Map titles + Group Layers provides up to 5+ levels of depth

# _Multilingual_ — moderators create language-specific curated Web Maps assigned to the appropriate language category

# _Role-based access_ (future) — different curated Web Maps can be shared with different Portal groups, controlling who sees what

# _Separation of concerns_ — ArcGIS Pro is used for data modelling and service publishing only; Portal is used for content organisation

_Client implementation requirements for Approach 4:_

- The {{CatalogService}} already supports this approach — it queries by category, loads multiple Web Maps, and builds the tree from categories + webmap titles + group layers
- Relationship navigation must resolve target layers by service URL and layer ID across all loaded Web Maps (not just the source Web Map)
- A fallback mechanism should load related layers on demand if they are not in any currently loaded Web Map

---

h2. References

- [ArcGIS Portal — Categories|https://enterprise.arcgis.com/en/portal/latest/administer/windows/manage-categories.htm]
- [ArcGIS REST API — Query Related Records|https://developers.arcgis.com/rest/services-reference/enterprise/query-related-records-feature-service-layer-/]
- [ArcGIS JS SDK — FeatureLayer.queryRelatedFeatures|https://developers.arcgis.com/javascript/latest/api-reference/esri-layers-FeatureLayer.html#queryRelatedFeatures]
- [RIMA Content Catalog Implementation|documentation/644-webclient_content_catalog/content-catalog.md]
