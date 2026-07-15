h1. Feature Editing

_Task:_ 583
_Branch:_ feature/585-3D_view
_Date:_ July 2026

---

h2. Executive Summary

The Editing system allows users to modify both attributes and geometry of map features directly within the web client. Editing is triggered from the popup header and runs as a standalone overlay panel. The system supports undo/redo for geometry changes, respects field-level permissions, and handles related "reference point" child features as part of the save operation. All changes are validated and saved back to the ArcGIS Portal.

---

h2. Overview

The Editing system allows users to modify both _attributes_ and _geometry_ of map features. Editing is triggered from the popup header and runs as a standalone overlay panel independent of the popup. A single {{EditService}} and {{EditStore}} own the entire edit session — attribute changes, geometry sketching, and reference-point management are all coordinated through these two units.

Edit capability is checked at runtime via {{isLayerEditable(graphic)}} in {{layer/layer-capabilities.ts}}, which requires {{layer.editingEnabled}} and {{capabilities.editing.supportsUpdateByOthers}}. Field mutability is determined by {{isImmutableField(fieldName, layer)}} in {{layer/layer-attributes.ts}}, which checks {{field.editable}} and excludes the subtype field.

---

h2. Architecture

h3. Edit subsystem ({{map/edit/}})

||Unit||Role||
|{{EditStore}}|NgRx SignalStore — unified state for both attribute and geometry editing: graphic, original/edited attributes, edited geometry, sketch state, undo/redo.|
|{{EditService}}|Manages the full edit lifecycle: activates/cancels sessions, manages the highlight layer, owns the {{SketchViewModel}}, calls {{applyEdits()}}, and coordinates {{ReferencePointService}}.|
|{{EditFormComponent}}|Single edit panel ({{rima-edit-form}}) with a Geometry section, an Attributes section, and an optional Reference Points section.|
|{{EditEffects}}|Root effect service — exposes {{editing}} and {{isDirty}} computed signals, auto-refreshes the popup on layer edits.|
|{{edit-config.ts}}|Edit symbols (point, line, polygon — dashed blue).|
|{{edit-errors.ts}}|{{EditSaveError}} (recoverable), {{EditRefreshError}} (silent).|

h3. Reference Points ({{map/shared/reference-point/}})

Reference points are related "von" (from) and "bis" (to) child features linked to the parent via a layer relationship. They are loaded on edit activation and saved as part of the edit save.

||Unit||Role||
|{{ReferencePointStore}}|State for vonPoints, bisPoints, deleted ids, active edit, sketch state, loading/saving flags.|
|{{ReferencePointService}}|{{loadForFeature()}}, {{saveAll()}}, {{reset()}}, and sketch lifecycle for adding/editing points.|
|{{ReferencePointResolutionService}}|Resolves relationship metadata from the layer and queries existing child features.|
|{{ReferencePointListComponent}}|Renders the list of reference points with add/edit/delete/sketch actions for each type.|

_Computed signals on {{ReferencePointStore}}:_

||Signal||Derivation||
|{{hasRelationships}}|{{vonRelationship != null \|\| bisRelationship != null}}|
|{{hasPendingChanges}}|Any new, modified, or deleted points in either von or bis list|
|{{sketchActive}}|True while a reference-point sketch is in progress|

h3. Supporting modules

||Module||Role||
|{{layer/layer-capabilities.ts}}|{{isLayerEditable(graphic)}} — checks {{editingEnabled}} and {{supportsUpdateByOthers}}.|
|{{layer/layer-attributes.ts}}|{{isImmutableField(fieldName, layer)}} — {{true}} for non-editable fields and the subtype field.|
|{{layer/layer-attribute-domain-resolver.ts}}|{{resolveEditableAttributeFields(graphic)}} — builds {{AttributeEditField[]}} for the form.|
|{{shared/sketch-utils.ts}}|{{buildSnappingSources()}}, {{updateUndoRedoState()}}, {{cleanupSketchResources()}}.|
|{{shared/attribute-form/}}|{{AttributeFormComponent}} — shared dynamic form driven by {{AttributeEditField[]}} and a value map.|
|{{shared/attribute-edit-field.ts}}|{{AttributeEditField}} type and {{convertAttributeFieldType()}}.|

---

h2. Edit Flow

h3. 1. Activation

The popup header shows a pencil icon if {{isLayerEditable(graphic)}} returns {{true}}. Clicking it calls {{EditService.activate(graphic)}}, which:

# Calls {{EditStore.activate(graphic)}} — snapshots attributes and resets all geometry/sketch state.

# Closes the popup ({{popupStore.close()}}).

# Shows a _highlight graphic_ on the map using the edit symbol for the feature's geometry type.

# Calls {{ReferencePointService.loadForFeature(graphic)}} — queries related child features and populates {{ReferencePointStore}}.

The {{EditFormComponent}} becomes visible whenever {{editStore.active()}} is {{true}}.

h3. 2. State ({{EditStore}})

{code}
EditState {
graphic: Graphic | undefined
originalAttributes: Record<string, V>
editedAttributes: Record<string, V>
editedGeometry: Geometry | undefined
sketchActive: boolean
saving: boolean
canUndo: boolean
canRedo: boolean
}
{code}

_Computed signals:_

||Signal||Derivation||
|{{active}}|{{graphic != null}}|
|{{isAttributesDirty}}|Any key in {{editedAttributes}} differs from {{originalAttributes}}|
|{{isGeometryDirty}}|{{editedGeometry != null}}|
|{{isDirty}}|{{isAttributesDirty \|\| isGeometryDirty}}|

_Methods:_

||Method||Behaviour||
|{{activate(graphic)}}|Snapshots attributes; resets all sketch/geometry state.|
|{{updateField(name, value)}}|Updates a single key in {{editedAttributes}}.|
|{{updateGeometry(geometry)}}|Stores the latest geometry from a sketch event.|
|{{clearGeometry()}}|Removes {{editedGeometry}} (used on geometry discard).|
|{{setSketchActive(boolean)}}|Tracks whether the sketch tool is running.|
|{{setSaving(boolean)}}|Toggles the in-flight saving flag.|
|{{setUndoRedo(canUndo, canRedo)}}|Updates undo/redo availability from the SketchViewModel.|
|{{deactivateSketch()}}|Resets {{sketchActive}}, {{canUndo}}, {{canRedo}}.|
|{{reset()}}|Returns all state to initial values.|

h3. 3. Geometry editing within the edit panel

The geometry section appears in {{EditFormComponent}} if {{supportsGeometryUpdate}} is {{true}} for the layer.

_States:_

||Sketch state||UI shown||
|No geometry staged|_"Edit Geometry"_ button — calls {{startGeometryEditing()}}.|
|{{sketchActive}}|"Editing geometry..." label + Undo / Redo / _Confirm_ (✓) / _Discard_ (↺) buttons.|
|Geometry staged|"Geometry modified" badge + _"Continue Editing"_ button.|

_{{EditService}} geometry methods:_

||Method||Behaviour||
|{{startGeometryEditing()}}|Removes highlight, clones original geometry for rollback, activates {{SketchViewModel}} via {{activateSketch()}}.|
|{{confirmGeometry()}}|Deactivates sketch; shows highlight at the staged geometry.|
|{{discardGeometry()}}|Deactivates sketch, calls {{store.clearGeometry()}}, restores highlight at original geometry.|
|{{reenterSketch()}}|Deactivates and re-activates sketch using {{editedGeometry ?? graphic.geometry}}.|
|{{undo()}} / {{redo()}}|Delegates to {{SketchViewModel}}; updates undo/redo in store.|

_{{SketchViewModel}} configuration:_

- {{updateOnGraphicClick: false}} — prevents re-selection on click
- Tool: {{move}} for points/multipoints, {{reshape}} for lines/polygons
- {{enableRotation: false}}, {{enableScaling: false}}
- {{reshapeOptions: \{ edgeOperation: 'split', shapeOperation: 'move' \}}}
- Snapping enabled against all {{FeatureLayer}} sources in the map ({{buildSnappingSources()}})

h3. 4. Attribute editing within the edit panel

The attributes section uses the shared {{AttributeFormComponent}} driven by {{resolveEditableAttributeFields(graphic)}} which:

# Filters out immutable fields ({{isImmutableField()}}).

# Resolves the effective domain per field (subtype domain takes precedence).

# Produces {{AttributeEditField[]}} with {{fieldType}}: {{string | integer | double | date | coded-value | guid}}.

Field changes call {{store.updateField(name, value)}}.

h3. 5. Reference points within the edit panel

If {{ReferencePointStore.hasRelationships()}} is {{true}}, the form shows {{rima-reference-point-list type="von"}} and {{rima-reference-point-list type="bis"}}. Changes (add/edit/delete) are tracked in {{ReferencePointStore}} as pending until the main save.

h3. 6. Save

{{EditService.save()}}:

# Sets {{saving = true}}.

# Deactivates sketch; removes highlight.

# Builds update payload: {{objectId}} + all mutable attribute fields from {{editedAttributes}} + optional {{editedGeometry}}.

# Calls {{layer.applyEdits(\{ updateFeatures: [updateGraphic] \})}}.

# On success: calls {{ReferencePointService.saveAll(parentId)}}, refreshes the layer, resets store, re-queries the feature, and reopens the popup with the refreshed graphic.

# On error: sets {{saving = false}} and throws {{EditSaveError}}.

_Confirmation dialog:_ "Are you sure you want to save the changes to this feature?"
_Close / Cancel with dirty state:_ "You have unsaved changes. Are you sure you want to discard them?"

h3. 7. Cancel

{{EditService.cancel()}}:

# Calls {{reset()}} — deactivates sketch, removes highlight, resets reference points, resets store.

# Reopens popup with the original graphic (unchanged).

h3. 8. Lifecycle

{{EditFormComponent.ngOnDestroy()}} calls {{editService.reset()}} ensuring all resources are freed if the component is destroyed externally.

---

h2. Click Suppression

{{PopupService.handleClick()}} ignores all map click events while an edit session is active (along with create and delete operations):

{code:language=typescript}
if (editStore.active() || createStore.active() || deleteStore.active()) {
return; // click suppressed
}
{code}

This prevents accidental popup changes while the user is editing.

---

h2. Edit Effects (Coordination)

{{EditEffects}} is a root-provided service:

_Computed signals:_

||Signal||Derivation||
|{{editing}}|{{editStore.active()}}|
|{{isDirty}}|{{editStore.isDirty()}}|

_Reactive behaviour — {{refreshPopupOnLayerEdits()}}:_

An effect watches {{popupStore.selectedGraphic()}}. When a graphic is selected it attaches a listener on the graphic's {{FeatureLayer}} {{edits}} event. When that event fires for the selected feature's {{objectId}}, it calls {{popupService.refreshSelectedGraphic()}} to re-query and update the popup display.

---

h2. Error Handling

||Error Class||Base Class||Scenario||
|{{EditSaveError}}|{{RecoverableError}}|{{applyEdits()}} fails or returns an error during save.|
|{{EditRefreshError}}|{{SilentError}}|Re-querying the layer after a save fails (non-critical).|
