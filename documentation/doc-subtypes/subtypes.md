h1. Subtypes via Definition Queries — Evaluation & Findings

_Date:_ July 2026

---

h2. Executive Summary

RIMA uses three PostgreSQL master-tables (Anlagen, Bauwerke, Bauwerksteile) where each table stores multiple object types distinguished by a subtype field ({{type}}). In ArcGIS Pro, the same master-layer is imported multiple times — once per subtype — with a definition query filtering to that subtype's code. This creates individual layers per object type while sharing a single physical table. After evaluation, this approach proved unviable for the RIMA web client: empty definition-query layers do not expose which subtype they represent via the FeatureService, and relationships between subtypes degenerate into redundant, duplicate relationships between the same master-layers, causing bugs in ArcGIS Pro. This document details the architecture, problems found, and the recommendation to abandon the subtype-based approach.

---

h2. Architecture

h3. Database Model

RIMA's geodata resides in a PostgreSQL database with three master-tables:

||Master-Table||Description||Subtype Field||Example Subtypes||
|anlagen|Facilities (point geometry)|{{type}}|—|
|bauwerke|Structures (polygon geometry)|{{type}}|4A Brücken (code 41), 4B Überführungen (42), 4C Unterführungen (43), 4D Durchlässe (44), 4E Wannen (45), 5A Bergmännischer Tunnel (51), 5B Tagbautunnel (52), 6A Galerien (61)|
|bauwerksteile|Structure components (polygon geometry)|{{type}}|Einzelpfeiler, Rollenlager|

Each master-table uses an integer {{type}} field as the subtype discriminator. All features of all subtypes coexist in the same table.

h3. ArcGIS Pro Publishing Setup

In ArcGIS Pro, the publishing workflow is:

# Import the same master-layer _N times_ (once per subtype)

# On each imported layer, set a _definition query_: {{type = <subtypeCode>}} (e.g., {{type = 42}} for "4B Überführungen")

# Configure _field visibility_ and _read-only_ settings per layer — allowing different fields to be shown/editable per subtype

# Configure _symbology_ per layer — each subtype layer gets its own renderer

# Group the subtype layers under their master-layer name (e.g., all Bauwerk subtypes grouped under "Bauwerke")

# Define _relationships_ between layers that need to reference each other

# Publish as a FeatureService

This effectively creates one Feature Layer per subtype in the published service, each showing only a filtered slice of the master-table.

h3. Published Service Structure

After publishing, the FeatureService exposes layers such as:

{code}
FeatureServer/
├── 0 Anlage (Feature Layer)
├── 5 Bauwerke (Group Layer)
│ ├── 6 4A Brücken (Feature Layer, definition query: type = 41)
│ ├── 7 4B Überführungen (Feature Layer, definition query: type = 42)
│ ├── 8 4C Unterführungen (Feature Layer, definition query: type = 43)
│ ├── 9 4D Durchlässe (Feature Layer, definition query: type = 44)
│ ├── 10 4E Wannen (Feature Layer, definition query: type = 45)
│ ├── 11 5A Bergm. Tunnel (Feature Layer, definition query: type = 51)
│ ├── 12 5B Tagbautunnel (Feature Layer, definition query: type = 52)
│ └── 13 6A Galerien (Feature Layer, definition query: type = 61)
├── 14 Bauwerksteile (Group Layer)
│ ├── 15 Einzelpfeiler (Feature Layer, definition query: type = ...)
│ └── 16 Rollenlager (Feature Layer, definition query: type = ...)
{code}

Each subtype layer's REST JSON exposes:

- {{subtypeFieldName: "type"}} — the field used for subtyping
- {{subtypes}} / {{types}} — the _full list_ of all subtypes from the master-table (not just this layer's subtype)
- {{parentLayer}} — reference to the group layer
- {{relationships}} — all relationship classes defined on the master-table
- {{fields}} — the fields configured as visible for this layer

h3. Key Observation: Layer Does Not Declare Its Own Subtype

A published subtype layer (e.g., "4B Überführungen", layer ID 7) contains:

- The definition query filtering to {{type = 42}} — but this is _not exposed in the FeatureService REST JSON_
- The complete {{subtypes}} array with _all_ subtypes (codes 0, 41, 42, 43, 44, 45, 51, 52, 61)
- No property indicating "this layer represents subtype code 42"

The layer's identity as a specific subtype is determined _solely_ by:

- Its display name (configured in ArcGIS Pro)
- The definition query (which is applied server-side but not exposed via REST)

---

h2. Critical Problems

h3. Problem 1: Empty Layers Do Not Expose Their Subtype Identity

_Impact: HIGH_

When a definition-query layer contains no features (empty subtype), the FeatureService provides no way for the web client to determine _which_ subtype the layer represents:

- The definition query (e.g., {{type = 42}}) is _not exposed_ in the layer's REST JSON
- The {{subtypes}} / {{types}} arrays list _all_ subtypes of the master-table, not the one this layer filters to
- Querying features to inspect the {{type}} field value is impossible when the layer is empty
- The only identifier is the layer _name_ (e.g., "4B Überführungen"), which is fragile and language-dependent

_Current workaround in the web client:_

# Query the first feature of the layer and read its {{type}} field value to determine the subtype code

# If the layer is empty (no features returned), fall back to matching the layer's display name against the {{subtypes}} / {{types}} list exposed in the layer's REST JSON

This workaround is _not stable_ and must be refactored or the data model remodelled for production:

- Name matching is fragile — names may change, may not be unique, or may differ across languages
- The first-feature approach fails entirely on empty layers, which are a normal state in the system
- Publishing warnings in ArcGIS Pro ("Web map does not contain all related tables/features") further confirm the service is not correctly representing the layer structure
- Testing via the ESRI Portal also surfaces inconsistencies with this approach

_Consequence:_ The web client cannot programmatically determine a layer's subtype code. This breaks:

- Subtype-aware editing (knowing which code to set when creating features)
- Relationship navigation (knowing which related subtypes to filter to)
- Dynamic UI (showing subtype-specific forms or validation rules)

h3. Problem 2: Relationships Become Redundant and Ambiguous

_Impact: HIGH_

Because all subtype layers of a master-table share the same physical table, relationship classes are defined at the table level. When the service is published, _every_ subtype layer of that master-table inherits _all_ relationships defined on the table.

Example from the "4B Überführungen" layer's REST JSON:

{code}
"relationships": [
{ "name": "bauwerk", "relatedTableId": 2, "id": 10 },
{ "name": "bauwerk", "relatedTableId": 1, "id": 1 },
{ "name": "bauwerk", "relatedTableId": 11, "id": 16 },
{ "name": "bauwerk", "relatedTableId": 12, "id": 17 }
]
{code}

Problems:

- _All relationships have the same name_ ({{bauwerk}}) — they are indistinguishable programmatically
- _Multiple relationships point to different layers_ (IDs 1, 2, 11, 12) that are all instances of the same master-table
- The web client cannot determine which relationship is the "correct" one for this specific subtype
- _Every subtype layer shows the same list of relationships_, even though logically only a subset applies

h3. Problem 3: ArcGIS Pro Instability with Redundant Relationships

_Impact: HIGH_

In ArcGIS Pro, defining relationships between subtype layers that share the same underlying table results in:

- _Multiple relationship classes between the same origin and destination table_ — because "4A Brücken → Einzelpfeiler" and "4B Überführungen → Rollenlager" both resolve to "bauwerke → bauwerksteile" at the physical level
- The Relate/Relationship panels in ArcGIS Pro display _many duplicate-looking entries_ that are functionally identical
- This appears to cause _buggy or unstable behaviour_ in ArcGIS Pro's relationship navigation
- Users cannot easily distinguish which relationship corresponds to which subtype pair

h3. Problem 4: Field Visibility Tied to Definition-Query Layers

_Impact: MEDIUM_

The per-subtype field visibility and read-only configuration is bound to the definition-query layer in ArcGIS Pro. This works well for display purposes, but:

- The FeatureService REST JSON does not distinguish between "field hidden because of subtype config" and "field not present on the table"
- All fields from the master-table are technically present on every subtype layer
- The client must rely on the {{fields}} array in the REST JSON to determine visibility — but this reflects the ArcGIS Pro config and may not survive re-publishing

---

h2. Pros and Cons

h3. Pros of Definition-Query Subtype Layers

||Advantage||Description||
|Single table per domain|Simpler PostgreSQL schema — one table for all Bauwerk types|
|Shared attributes|Common columns (geometry, status, id, globalid) managed once|
|Per-subtype symbology|Each layer can have its own renderer configured in ArcGIS Pro|
|Per-subtype field visibility|Fields can be shown/hidden and set read-only per layer|
|ArcGIS Pro editing support|Creating features automatically assigns the correct subtype code via definition query|
|Storage efficiency|One table, one index, one versioning context for all subtypes|
|Subtype-specific domains|Each subtype code can have its own coded value domains for attribute fields|

h3. Cons of Definition-Query Subtype Layers (for RIMA)

||Disadvantage||Description||Severity||
|No subtype identity on empty layers|FeatureService does not expose which subtype code a layer filters to|HIGH|
|Relationship duplication|Every subtype layer inherits all relationships from the master-table|HIGH|
|Relationship ambiguity|Multiple relationships with same name pointing to different layers|HIGH|
|ArcGIS Pro relationship bugs|Redundant relationship classes between same table pair causes instability|HIGH|
|Cannot determine subtype programmatically|No REST property indicates the layer's definition query or target subtype code|HIGH|
|Related feature over-fetching|Relationship queries return features from all subtypes, not just the target|MEDIUM|
|Fragile layer identification|Layer identity depends on display name matching — no structural guarantee|MEDIUM|
|Schema coupling|Adding/removing subtypes requires re-importing and re-configuring layers in ArcGIS Pro|MEDIUM|
|Full subtype list on every layer|{{subtypes}} and {{types}} arrays contain all subtypes, not just the relevant one|LOW|

---

h2. Conclusion & Recommendation

The definition-query-based subtype approach is _not viable_ for the RIMA web client due to:

# _No programmatic subtype identity_ — the FeatureService does not expose which subtype code a layer represents, making it impossible to implement subtype-aware editing, filtering, or relationship navigation when layers are empty

# _Relationship model collapse_ — all relationships are defined at the master-table level, causing every subtype layer to inherit every relationship with identical names and no way to disambiguate

# _ArcGIS Pro instability_ — redundant relationship classes between the same physical tables causes bugs in the relationship navigation panels

_Recommendation:_ Use _separate physical Feature Classes_ (one table per object type) instead of subtypes within a shared master-table. This approach:

- Gives each layer a unique, self-contained identity regardless of feature count
- Allows clean 1:1 relationship classes between specific Feature Classes
- Eliminates relationship duplication and ambiguity
- Works natively with the ArcGIS JS SDK and FeatureService REST API
- Allows per-layer field configuration without relying on definition queries
- Simplifies the web client layer handling

The trade-off is more tables in the database and more layers in the service, but this is acceptable given the reliability, clarity, and reduced complexity it provides to both the web client and ArcGIS Pro workflows.

---

h2. References

- [ArcGIS REST API — Feature Service Layer|https://developers.arcgis.com/rest/services-reference/enterprise/feature-layer/]
- [ArcGIS Pro — Definition Queries|https://pro.arcgis.com/en/pro-app/latest/help/mapping/layer-properties/definition-query.htm]
- [ArcGIS Pro — Subtypes|https://pro.arcgis.com/en/pro-app/latest/help/data/geodatabases/overview/an-overview-of-subtypes.htm]
- [ArcGIS Pro — Relationship Classes|https://pro.arcgis.com/en/pro-app/latest/help/data/geodatabases/overview/relationship-class-properties.htm]
