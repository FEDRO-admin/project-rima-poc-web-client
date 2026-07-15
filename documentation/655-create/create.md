h1. Feature Create

_Task:_ 655
_Branch:_ feature/585-3D_view
_Date:_ July 2026

---

h2. Executive Summary

The Create system allows users to add new map features (points, lines, polygons) by drawing them directly on the map and filling in their attributes. It is launched from the Table of Contents sidebar, guides the user through geometry placement with snapping support, and saves the new feature to the ArcGIS Portal. Related reference points can also be defined during the creation process.

---

h2. Overview

The Create system allows users to add new features to an editable {{FeatureLayer}} directly on the map. It is triggered from the _Table of Contents (TOC)_ via a "Create" action on any {{FeatureLayer}} entry, and runs as a standalone overlay panel ({{rima-create-form}}) that is always present in the map layout but only visible when {{createStore.active()}} is {{true}}.

The flow follows four ordered phases:

# _Select a drawing tool_ — user picks the geometry type for the new feature.

# _Draw_ — user places the geometry on the map via {{SketchViewModel}}.

# _Adjust_ — user fine-tunes placement (move/rotate) immediately after drawing.

# _Fill attributes & save_ — user completes the attribute form, optionally manages reference points, then saves.

Layer create capability is checked via {{isLayerCreatable(layer)}} in {{layer/layer-capabilities.ts}}, which requires {{layer.editingEnabled}} and {{capabilities.operations.supportsAdd}}. Field availability is determined by {{isImmutableField()}} in {{layer/layer-attributes.ts}}.

---

h2. Architecture

h3. Create subsystem ({{map/create/}})

||Unit||Role||
|{{CreateStore}}|NgRx SignalStore — active flag, target layer, subtype selection, attribute values, geometry, sketch/adjust state, undo/redo, saving.|
|{{CreateService}}|Orchestrates {{save()}} ({{applyEdits(\{ addFeatures \})}}), {{saveAndOpenInPopup()}}, and {{cancel()}}.|
|{{CreateGeometryService}}|Manages the full sketch lifecycle: draw → auto-adjust → confirm placement. Owns the {{SketchViewModel}}.|
|{{CreateFormComponent}}|Standalone overlay panel ({{rima-create-form}}) with tool selector, geometry status, attribute form, reference points, and actions.|
|{{CreateEffects}}|Root effect service — closes the popup when create activates; cancels any active edit session when create starts.|
|{{create-attribute.service}}|{{resolveCreatableFields(layer, subtypeValue)}} and {{buildDefaultAttributes(layer, fields)}}.|
|{{create-config.ts}}|{{getDrawingToolsForGeometryType()}}, {{getDefaultCreateTool()}}, {{getGeometryTypeLabel()}}.|
|{{create-errors.ts}}|{{CreateSaveError}}, {{CreateLayerLoadError}}, {{CreateFormLoadError}}.|

h3. Supporting infrastructure

||Module / Component||Role||
|{{toc/toc.component.ts}}|Adds a "Create" action to each {{FeatureLayer}} in the layer list; calls {{CreateStore.activate()}}.|
|{{layer/layer-capabilities.ts}}|{{isLayerCreatable(layer)}} — checks {{editingEnabled}} and {{supportsAdd}}.|
|{{layer/layer-attributes.ts}}|{{isImmutableField()}} — filters out non-editable fields from the create payload.|
|{{layer/layer-attribute-domain-resolver.ts}}|{{resolveCreatableFields()}} — resolves fields and domains for the attribute form.|
|{{shared/sketch-utils.ts}}|{{buildSnappingSources()}}, {{updateUndoRedoState()}}, {{cleanupSketchResources()}}.|
|{{shared/attribute-form/}}|{{AttributeFormComponent}} — shared dynamic form driven by {{AttributeEditField[]}}.|
|{{shared/reference-point/}}|{{ReferencePointService.initializeForCreate()}}, {{saveAll()}} — manages related child features.|

---

h2. Activation

The TOC ({{TocComponent}}) adds a _"Create"_ button action to every {{FeatureLayer}} in the {{arcgis-layer-list}}. When clicked, {{TocComponent.createFeature(layer)}} runs:

# Loads the layer ({{layer.load()}}).

# Resolves the subtype field via {{getSubtypeFieldName(layer)}}.

# Determines the default subtype value by querying an existing feature, then falling back to {{getSubtypeCodeFromLayerName()}} or {{getDefaultSubtypeCode()}}.

# Calls {{CreateStore.activate(layer, subtypeField?, subtypeValue?)}}.

{{CreateStore.activate()}}:

- Calls {{resolveCreatableFields(layer, subtypeValue)}} to build the field list.
- Calls {{buildDefaultAttributes(layer, fields)}} to populate initial values.
- Resets all geometry/sketch state.

{{CreateEffects}} reacts to {{createStore.active()}} becoming {{true}}:

- _Closes the popup_ ({{popupStore.close()}}).
- _Cancels any active edit session_ if {{editEffects.editing()}} is {{true}}.

The {{CreateFormComponent}} renders as soon as {{createStore.active()}} is {{true}}.

---

h2. State ({{CreateStore}})

{code}
CreateState {
active: boolean
layer: FeatureLayer | undefined
subtypeField: string | undefined
subtypeValue: number | string | undefined
attributes: Record<string, AttributeValue>
geometry: Geometry | undefined
sketchActive: boolean // true while the draw sketch is running
adjusting: boolean // true while the post-draw adjust tool is running
saving: boolean
canUndo: boolean
canRedo: boolean
}
{code}

_Computed signal:_

||Signal||Derivation||
|{{isDirty}}|Any attribute value is non-null/non-empty, or {{geometry != null}}|

_Methods:_

||Method||Behaviour||
|{{activate(layer, subtype?)}}|Resolves fields/defaults, resets all state, sets {{active = true}}.|
|{{updateField(name, value)}}|Updates a single attribute key.|
|{{setAttributes(attrs)}}|Replaces the entire attribute map.|
|{{updateGeometry(geometry)}}|Stores the current geometry from the sketch.|
|{{setSketchActive(boolean)}}|Tracks the draw phase.|
|{{setAdjusting(boolean)}}|Tracks the post-draw adjust phase.|
|{{setSaving(boolean)}}|Toggles in-flight saving flag.|
|{{setUndoRedo(canUndo, canRedo)}}|Updates undo/redo availability from the SketchViewModel.|
|{{deactivateSketch()}}|Resets {{sketchActive}}, {{adjusting}}, {{canUndo}}, {{canRedo}}.|
|{{reset()}}|Returns all state to initial values.|

---

h2. Geometry Lifecycle ({{CreateGeometryService}})

h3. Phase 1 — Draw

{{startDrawing(layer, tool?)}} sets up a {{SketchViewModel}} in _create mode_:

- Creates a hidden {{GraphicsLayer}} ({{listMode: 'hide'}}) and adds it to the map.
- Instantiates a {{SketchViewModel}} with the edit symbols from {{edit-config.ts}} (shared with the edit feature) and snapping against all {{FeatureLayer}} sources.
- Calls {{sketchViewModel.create(tool)}} to start the active drawing tool.
- Sets {{sketchActive = true}}.

When the {{create}} event fires with {{state: 'complete'}}:

- The drawn graphic is stored.
- {{sketchActive = false}}, {{adjusting = true}}.
- Automatically enters _adjust mode_ ({{startAdjusting()}}) — switches to {{update}} tool with {{enableRotation: true}} and {{toggleToolOnClick: true}} so the user can move and rotate the geometry.

_Drawing tools by geometry type:_

||Geometry type||Available tools||
|point|point|
|polyline|polyline, freehandPolyline|
|polygon|polygon, rectangle, circle, freehandPolygon|

h3. Phase 2 — Adjust

While {{adjusting}} is {{true}}, the form shows "Adjust geometry..." with Undo / Redo / _Confirm_ (✓) / _Redraw_ (↺) buttons.

- _{{undo()}}_ / _{{redo()}}_ — delegate to {{SketchViewModel}}.
- Sketch {{update}} events with {{state: 'active'}} or {{'complete'}} update {{geometry}} and undo/redo state.
- When a {{'complete'}} event fires, {{reenterUpdate()}} is called to keep the adjust tool active.

h3. Phase 3 — Confirm / Redraw

||Action||Method||Behaviour||
|Confirm (✓)|{{confirmPlacement()}}|Cancels the update tool, finalises geometry in the store, sets {{adjusting = false}}.|
|Redraw (↺)|{{redraw(layer, tool?)}}|Calls {{cleanup()}} then {{startDrawing()}} fresh; clears geometry.|
|Edit (after confirm)|{{reenterAdjusting()}}|Re-enters adjust mode if the user wants to tweak a confirmed geometry.|

After {{confirmPlacement()}}, the form shows "Geometry added" with _Edit_ and _Redraw_ buttons.

---

h2. Attribute Editing

The attributes section uses the shared {{AttributeFormComponent}} driven by {{resolveCreatableFields(layer, subtypeValue)}}:

# Filters out immutable fields ({{isImmutableField()}}).

# Resolves the effective domain per field — subtype-specific domain takes precedence over field-level domain.

# Produces {{AttributeEditField[]}} with {{fieldType}}: {{string | integer | double | date | coded-value | guid}}.

# Default values are pre-populated via {{buildDefaultAttributes()}} from each field's {{defaultValue}}.

The attribute form shows a required-field indicator ({{showRequiredIndicator = true}}). Field changes call {{createStore.updateField(name, value)}}.

---

h2. Reference Points

If the target layer has related "von" / "bis" child layers, {{ReferencePointService.initializeForCreate(layer)}} is called during form initialisation (via an effect in {{CreateFormComponent}}). This populates {{ReferencePointStore}} with the relationship metadata so the {{rima-reference-point-list}} components can render.

Reference-point sketches are disabled while {{sketchActive}} or {{adjusting}} is {{true}}. Newly added reference points are held in {{ReferencePointStore}} as pending until the main feature is saved.

---

h2. Save

_canSave:_ {{geometry != null && !saving}}.

Clicking _"Create Feature"_ sets {{confirmAction = 'save'}}, showing:
_"Are you sure you want to create this feature?"_

On confirmation, {{CreateService.saveAndOpenInPopup()}} runs:

# Calls {{save()}}:

#_ {{createGeometryService.cleanup()}} — destroys the {{SketchViewModel}} and removes the sketch layer. #_ {{buildCreatePayload()}} — collects all mutable, non-objectId attributes plus the subtype field value. #_ {{layer.applyEdits(\{ addFeatures: [newGraphic] \})}}. #_ Returns the new feature's {{objectId}}.

# Calls {{layer.refresh()}} to update the map display.

# Re-queries the new feature: {{layer.queryFeatures(\{ objectIds: [objectId], outFields: ['*'], returnGeometry: true \})}}.

# Calls {{ReferencePointService.saveAll(parentId)}} for any pending reference points.

# Resets the store ({{createStore.reset()}}).

# Opens the popup with the newly created feature graphic.

On error: sets {{saving = false}} and throws {{CreateSaveError}} / {{CreateFormLoadError}}.

---

h2. Cancel

Clicking _"Cancel"_ (or pressing Escape) calls {{requestCancel()}} / {{requestClose()}}:

- If {{createStore.isDirty()}}, shows a confirmation dialog:
  _"You have unsaved changes. Are you sure you want to discard them?"_
- On confirmation, calls {{close()}}:
  ** {{createGeometryService.cancel()}} — cleans up sketch resources.
  ** {{createStore.reset()}}.

{{CreateFormComponent.ngOnDestroy()}} also calls {{createGeometryService.cancel()}} to ensure cleanup if the component is destroyed externally.

---

h2. Click Suppression

{{PopupService.handleClick()}} ignores all map clicks while {{createEffects.creating()}} is {{true}}, preventing accidental popup changes while drawing.

---

h2. Error Handling

||Error Class||Base Class||Scenario||
|{{CreateSaveError}}|{{RecoverableError}}|{{applyEdits()}} fails or returns an error during feature create.|
|{{CreateLayerLoadError}}|{{RecoverableError}}|Error loading the feature layer for creation.|
|{{CreateFormLoadError}}|{{RecoverableError}}|Error saving the feature and opening the popup afterwards.|
