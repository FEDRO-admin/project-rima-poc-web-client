h1. Relationships & Table Relates — Architecture & Findings

_Date:_ July 2026

---

h2. Executive Summary

RIMA requires navigable relationships between geospatial features — from a Bauwerk (structure) to its Bauwerksteile (components) and associated reference points. ArcGIS Relationship Classes enable this, but their behaviour across Web Maps, services, and client applications introduces significant constraints. Key finding: _Web Maps must contain all related tables_ for relationships to function correctly. Intra-webmap relationships (across different Web Maps) are not supported by ArcGIS. This document details how relationships work in the ArcGIS ecosystem, how the RIMA web client resolves them, the constraints discovered, and the implications for production architecture.

---

h2. ArcGIS Relationship Classes — Overview

h3. What Is a Relationship Class?

A Relationship Class defines a link between two Feature Classes (or tables) in a geodatabase. It specifies:

- _Origin table_ — the "parent" side of the relationship
- _Destination table_ — the "child" or related side
- _Cardinality_ — one-to-one, one-to-many, or many-to-many
- _Key fields_ — the fields used to join records (typically GUIDs or IDs)
- _Role_ — from the perspective of each layer: {{origin}} (has children) or {{destination}} (is child of)

When published to ArcGIS Server, relationship classes become part of the FeatureService's REST JSON. Each layer exposes a {{relationships}} array listing all relationships it participates in.

h3. REST Representation

Each layer's REST JSON (e.g., {{FeatureServer/7?f=pjson}}) includes:

{code}
"relationships": [
{
"keyField": "id",
"role": "esriRelRoleOrigin",
"name": "bauwerk",
"relatedTableId": 11,
"id": 16,
"cardinality": "esriRelCardinalityOneToMany"
}
]
{code}

Key properties:

- {{role}} — {{esriRelRoleOrigin}} means this layer is the parent (has children in the related table)
- {{relatedTableId}} — the _layer index within the same FeatureService_ where related features reside
- {{id}} — the relationship ID used in query operations
- {{keyField}} — the field in this layer that links to the related table

h3. Querying Related Features

The ArcGIS REST API provides {{queryRelatedRecords}}:

{code}
POST FeatureServer/7/queryRelatedRecords
objectIds: [42]
relationshipId: 16
outFields: \*
returnGeometry: true
{code}

This returns all features from the related table ({{relatedTableId: 11}}) that are linked to the specified object(s). The query is executed _on the FeatureService_, not on the Web Map.

---

h2. Current Implementation in RIMA

h3. Hierarchy Tree (Popup)

The web client implements relationship navigation through a _hierarchy tree_ displayed in the popup's "Hierarchy" tab. The {{HierarchyService}} builds a parent→child tree for a clicked feature:

# _Find parent chain:_ Walk up the relationship graph by querying relationships where {{role === 'destination'}} (current layer is a child)

# _Find children:_ Query relationships where {{role === 'origin'}} (current layer has children), recursing into grandchildren

# _Build tree:_ Assemble a {{HierarchyNode}} tree with the clicked feature in context

{code}
Example tree for a clicked "4A Brücken" feature:
└── Anlage: "A001 Autobahn Zürich" (parent, via destination relationship)
└── Bauwerk: "Brücke Limmat" (clicked feature)
├── Bauwerksteil (3) (children group)
│ ├── Einzelpfeiler: "P1"
│ ├── Einzelpfeiler: "P2"
│ └── Rollenlager: "R1"
├── Referenzpunkt von (1)
│ └── "RP-001"
└── Referenzpunkt bis (1)
└── "RP-002"
{code}

h3. Related Layer Resolution

The {{HierarchyService}} resolves related layers using:

{code}
private findLayerByRelationship(relationship: Relationship): FeatureLayer | undefined {
const allLayers = view.map.allLayers;
return allLayers.find(l => l.layerId === relationship.relatedTableId);
}
{code}

This searches _all loaded layers on the map_ for a layer whose {{layerId}} (service layer index) matches the relationship's {{relatedTableId}}.

_Critical implication:_ If the related layer is not loaded on the map (because it was not included in any loaded Web Map), the relationship query _still returns data_ (it goes to the FeatureService directly), but the result cannot be assigned a layer reference. This affects:

- Display label resolution (layer's {{displayField}} unavailable)
- Click-to-navigate (cannot highlight/zoom to a feature without its layer)
- Symbology (cannot render the related feature with correct styling)

h3. Reference Points (Von/Bis)

Reference points are related features managed through the edit and create forms. The {{ReferencePointResolutionService}} discovers relationships by:

# Finding relationships on the parent layer with {{role === 'origin'}}

# Classifying them as "von" or "bis" by matching the related layer's title against patterns ({{/punkt.*von/i}}, {{/punkt.*bis/i}})

# Querying existing reference points via {{queryRelatedFeatures}}

# Creating/updating/deleting reference points via {{applyEdits}} on the related layer

---

h2. Critical Constraint: Web Maps Must Contain All Related Tables

h3. Finding

According to ESRI documentation and confirmed by testing:

{panel:title=Key Finding|borderColor=#de350b}
Web Maps must contain all related tables and features defined in relationships. Intra-webmap relationships (relationships between layer services exposed in different Web Maps) are _not supported_. Web Maps are effectively decoupled containers which must independently contain all tables referenced by relationship classes.
{panel}

h3. Evidence

- _ArcGIS Pro publishing warnings:_ When publishing a Web Map that contains layers with relationships but does _not_ include all related tables, ArcGIS Pro displays a warning: _"Web map does not contain all related tables/features"_
- _ESRI Portal testing:_ Relationship navigation in the Portal Map Viewer fails when the related table is not included in the Web Map
- _ESRI documentation:_ [Understanding Relationship Classes in ArcGIS Online Hosted Feature Services|https://www.esri.com/arcgis-blog/products/arcgis-online/data-management/understanding-relationship-classes-in-arcgis-online-hosted-feature-services] confirms that related tables must be present in the Web Map for relationship functionality

h3. Implications for Production

This constraint effectively means:

- _All Web Maps loaded by the client must contain all layers_ that participate in any relationship class — this is not feasible when using multiple small topic-specific Web Maps (Approach 2 from the hierarchy documentation)
- Splitting data across multiple Web Maps _breaks relationship navigation_ in both the ESRI Portal and the web client
- The only reliable configurations are:
  ** _One large Web Map per language_ containing all layers (Approach 3 — current)
  ** _Multiple Web Maps all referencing the same service layers_ (Approach 4 — proposed), where the client loads all of them and has all layers available on the map

h3. Client Behaviour When Related Layer Is Missing

When a relationship query succeeds but the related layer is not loaded on the map:

||Scenario||Behaviour||
|Hierarchy tree navigation|Related features are returned by the service but cannot be assigned a layer — display label falls back to OID, click-to-navigate is unavailable|
|Reference point editing|Von/Bis relationships are not discovered because the related layer cannot be found via {{findLayerByRelationship}}|
|Popup related records|The relationship tab may show incomplete or missing hierarchy branches|

---

h2. Relationship Resolution Strategy

h3. Current Strategy

The web client resolves related layers by searching {{view.map.allLayers}} for a layer with matching {{layerId}} (service layer index). This works when:

- All related layers are loaded on the map (included in some loaded Web Map)
- The layers come from the same FeatureService ({{layerId}} matches {{relatedTableId}})

h3. Limitation

If multiple Web Maps reference layers from the same service, {{layerId}} matching works. However, if a related layer is not included in _any_ loaded Web Map, resolution fails silently — the relationship query returns data but the client cannot render or navigate to it.

h3. Proposed Enhancement for Production

For Approach 4 (moderator-curated Web Maps), the client should:

# Maintain a _service layer registry_ mapping every loaded layer's service URL + layerId

# When resolving a relationship, first search loaded layers (current behaviour)

# If not found, _on-demand load_ the target layer directly from the FeatureService using the service URL and {{relatedTableId}} — adding it to the map as a hidden layer

# This ensures relationship navigation always works, even if a moderator omitted a related table from their curated Web Map

---

h2. WIP: Current Testing

{panel:title=Work in Progress}
Further testing using a _single Web Map with Feature Layers combined with Group Layers_ (Approach 3) is in progress to validate that all relationships function correctly when all layers are contained within one Web Map per language.
{panel}

---

h2. Summary of Constraints

||Constraint||Source||Impact||
|Web Maps must contain all related tables|ESRI documentation + testing|Cannot split related layers across Web Maps|
|Relationship queries go to the FeatureService|ArcGIS REST API|Data is returned regardless of Web Map structure, but client rendering requires loaded layers|
|{{relatedTableId}} refers to layer index within the same service|FeatureService REST JSON|Cross-service relationships not possible|
|ArcGIS Pro warns on incomplete Web Maps|Publishing workflow|Confirmation that incomplete maps are unsupported|
|Client layer resolution requires loaded layers|Current implementation|Missing layers cause silent failures in hierarchy and reference points|
|Portal Map Viewer also requires all tables|ESRI Portal testing|Not just a client limitation — this is an ArcGIS platform constraint|

---

h2. References

- [Understanding Relationship Classes in ArcGIS Online|https://www.esri.com/arcgis-blog/products/arcgis-online/data-management/understanding-relationship-classes-in-arcgis-online-hosted-feature-services]
- [ArcGIS REST API — Query Related Records|https://developers.arcgis.com/rest/services-reference/enterprise/query-related-records-feature-service-layer-/]
- [ArcGIS JS SDK — FeatureLayer.queryRelatedFeatures|https://developers.arcgis.com/javascript/latest/api-reference/esri-layers-FeatureLayer.html#queryRelatedFeatures]
- [ArcGIS Pro — Relationship Classes|https://pro.arcgis.com/en/pro-app/latest/help/data/geodatabases/overview/relationship-class-properties.htm]
- [RIMA Hierarchy Documentation|documentation/doc-hierarchy/hierarchy.md]
- [RIMA Subtype Documentation|documentation/doc-subtypes/subtypes.md]
