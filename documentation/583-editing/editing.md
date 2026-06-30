# Feature Editing

**Task:** 583  
**Branch:** feature/583-editing  
**Date:** June 2026

---

## Overview

The Editing system allows users to modify both attributes and geometry of map features directly from within the popup detail view. It is split into two independent subsystems — **Attribute Editing** and **Geometry Editing** — each with its own store, service, and form component. A shared `EditEffects` service coordinates cross-cutting concerns such as dirty-state tracking and automatic popup refresh after edits are persisted.

Editing capabilities are determined at runtime by inspecting the ArcGIS `FeatureLayer` capabilities. Only layers where `editingEnabled` is `true` and `capabilities.editing.supportsUpdateByOthers` is `true` expose the edit UI. System fields (e.g. `OBJECTID`, `GLOBALID`, `SHAPE_LENGTH`, audit fields) are excluded from editing.

---

## Architecture

The editing system is organised into the following units:

| Unit                         | Role                                                                                                                                       |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `EditEffects`                | Root-provided service that computes aggregate `editing` and `isDirty` signals across both subsystems. Refreshes the popup after edits.     |
| `AttributeEditStore`         | NgRx SignalStore managing the graphic being edited, original vs. edited attribute values, dirty detection, and saving state.               |
| `AttributeEditService`       | Builds a minimal update payload and calls `FeatureLayer.applyEdits()` to persist attribute changes. Handles save/cancel lifecycle.         |
| `AttributeEditFormComponent` | Renders a dynamic form with type-appropriate input controls (text, number, date, dropdown) based on the layer's field definitions.         |
| `GeometryEditStore`          | NgRx SignalStore tracking editing/sketch state, the edited geometry, saving state, and undo/redo availability.                             |
| `GeometryEditService`        | Manages the ArcGIS `SketchViewModel` lifecycle — activates, deactivates, saves geometry changes via `applyEdits()`, and handles undo/redo. |
| `GeometryEditFormComponent`  | Renders the geometry editing toolbar with undo/redo buttons, save/cancel actions, and a "Continue Editing" re-entry button.                |

### Supporting modules

| Module                         | Role                                                                                                                      |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| `edit-capability.ts`           | Pure functions: `isLayerEditable(graphic)` checks layer editing permissions; `isSystemField(name)` filters system fields. |
| `edit-config.ts`               | Constants: edit symbols (point, line, polygon) and the set of system field names.                                         |
| `edit-errors.ts`               | Error classes: `EditSaveError` (recoverable), `EditRefreshError` (silent).                                                |
| `attribute-edit-field.ts`      | Type definitions for `AttributeEditField` and the field-type conversion function.                                         |
| `attribute-domain-resolver.ts` | Resolves editable fields from a graphic, including subtype-specific domains and coded-value options.                      |

---

## Attribute Editing

### State Management (AttributeEditStore)

```
EditState {
  graphic: Graphic | undefined            // the feature being edited
  originalAttributes: Record<string, V>   // snapshot at edit start
  editedAttributes: Record<string, V>     // live values as user types
  saving: boolean                         // true while applyEdits is in-flight
}
```

**Computed signals:**

| Signal    | Derivation                                                      |
| --------- | --------------------------------------------------------------- |
| `editing` | `graphic != null`                                               |
| `isDirty` | Any key in `editedAttributes` differs from `originalAttributes` |

**Methods:**

| Method                     | Behaviour                                                              |
| -------------------------- | ---------------------------------------------------------------------- |
| `startEditing(graphic)`    | Snapshots current attributes into both `original` and `edited` copies. |
| `updateField(name, value)` | Updates a single field in `editedAttributes`.                          |
| `setSaving(boolean)`       | Toggles the saving flag.                                               |
| `reset()`                  | Clears all state back to initial values.                               |

### Field Resolution (attribute-domain-resolver)

`resolveEditableAttributeFields(graphic)` analyses the FeatureLayer's field definitions and produces an array of `AttributeEditField` objects that drive the form:

1. Filters out non-editable fields and system fields.
2. For the `typeIdField`, produces a coded-value dropdown of layer subtypes.
3. For all other fields, resolves the effective domain: subtype-specific domain takes precedence over field-level domain.
4. Coded-value domains produce dropdown fields; numeric/date/string types produce appropriate input types.

### Persistence (AttributeEditService)

`save()` builds a minimal update payload containing only the `objectId` and the editable, non-system fields from `editedAttributes`, then calls `layer.applyEdits({ updateFeatures: [graphic] })`. On success, the store is reset. On failure, an `EditSaveError` is thrown.

`cancel()` simply resets the store, discarding all changes.

### Form Component (AttributeEditFormComponent)

Rendered as `<rima-edit-form>` inside the Attributes tab when edit mode is active. Dynamically generates input controls based on each field's `fieldType`:

| Field Type    | Control                                       |
| ------------- | --------------------------------------------- |
| `coded-value` | `<select>` dropdown with coded value options  |
| `integer`     | `<input type="number" step="1">`              |
| `double`      | `<input type="number" step="any">`            |
| `date`        | `<input type="datetime-local">`               |
| `string`      | `<input type="text">` with optional maxlength |

The component converts raw string values from HTML inputs back to their appropriate types (numbers, null for empty nullable fields) before updating the store.

**Confirmation dialogs:**

- **Save** — "Are you sure you want to save the changes to this feature?"
- **Cancel with dirty state** — "You have unsaved changes. Are you sure you want to discard them?"

When the component is destroyed (e.g. user navigates away from detail view), `DestroyRef.onDestroy()` automatically calls `cancel()`.

---

## Geometry Editing

### State Management (GeometryEditStore)

```
GeometryEditState {
  editing: boolean                   // true while geometry edit session is active
  sketchActive: boolean              // true while the SketchViewModel is running
  editedGeometry: Geometry | undefined   // latest geometry from the sketch
  saving: boolean                    // true while applyEdits is in-flight
  canUndo: boolean                   // from SketchViewModel
  canRedo: boolean                   // from SketchViewModel
}
```

**Computed signals:**

| Signal    | Derivation               |
| --------- | ------------------------ |
| `isDirty` | `editedGeometry != null` |

**Methods:**

| Method                          | Behaviour                                                     |
| ------------------------------- | ------------------------------------------------------------- |
| `setEditing(boolean)`           | Enters or exits editing mode.                                 |
| `setSketchActive(boolean)`      | Tracks whether the sketch tool is actively running.           |
| `updateGeometry(geometry)`      | Stores the latest geometry from a sketch update event.        |
| `setSaving(boolean)`            | Toggles the saving flag.                                      |
| `setUndoRedo(canUndo, canRedo)` | Updates undo/redo availability from the SketchViewModel.      |
| `deactivateSketch()`            | Resets sketch-related state (sketchActive, canUndo, canRedo). |
| `reset()`                       | Clears all state back to initial values.                      |

### Sketch Management (GeometryEditService)

`GeometryEditService` manages the full lifecycle of the ArcGIS `SketchViewModel`:

1. **`startEditing(graphic)`** — Clones the original geometry for rollback, creates a temporary `GraphicsLayer`, adds a sketch graphic with an edit symbol (dashed blue outline), and instantiates a `SketchViewModel` with:
   - `updateOnGraphicClick: false` (prevents re-selection on click)
   - Tool selection based on geometry type: `move` for points, `reshape` for lines/polygons
   - Rotation and scaling disabled
   - Snapping enabled against all `FeatureLayer` sources in the map

2. **`reenterSketch()`** — Re-activates the sketch tool if it was deactivated (e.g. after a sketch complete event), preserving the current edited geometry.

3. **`save()`** — Deactivates the sketch, builds a minimal update graphic with just the `objectId` and the edited geometry, calls `layer.applyEdits()`, then resets on success.

4. **`cancel()`** — Restores the original geometry on the graphic and resets all state.

5. **`undo()` / `redo()`** — Delegates to the SketchViewModel and updates the undo/redo availability in the store.

**Edit symbols** are defined in `edit-config.ts`:

| Geometry Type | Symbol                                               |
| ------------- | ---------------------------------------------------- |
| Point         | Blue marker (r=12), 30% opacity fill, dashed outline |
| Polyline      | Blue dashed line, width 3                            |
| Polygon       | Blue fill (10% opacity), dashed outline, width 2     |

### Form Component (GeometryEditFormComponent)

Rendered as `<rima-geometry-edit-form>` inside the Geometry tab when geometry editing is active. Displays:

- **Active sketch** — Status text "Editing geometry..." with undo/redo buttons.
- **Inactive sketch** — A "Continue Editing" button to re-enter the sketch tool.
- **Actions** — Cancel and "Save Geometry" buttons. Save is disabled when not dirty or while saving.

When the component is destroyed, `DestroyRef.onDestroy()` automatically calls `cancel()`.

---

## Edit Effects (Coordination)

`EditEffects` is a root-provided service that bridges the editing and popup subsystems:

**Computed signals:**

| Signal    | Derivation                                                      |
| --------- | --------------------------------------------------------------- |
| `editing` | `attributeEditStore.editing() \|\| geometryEditStore.editing()` |
| `isDirty` | `(attributeEditing && attributeDirty) \|\| geometryDirty`       |

**Reactive behaviour — `refreshPopupOnLayerEdits()`:**

An `effect()` watches `popupStore.selectedGraphic()`. When a graphic is selected, it attaches a listener on the graphic's FeatureLayer `edits` event. When that layer fires an edit event containing the selected feature's `objectId`, the popup store refreshes the selected graphic by re-querying the layer. This ensures the popup always shows the latest attribute values after a save.

---

## Integration with Popup

The editing system is integrated into the popup's tabbed detail view:

- **Attributes Tab** (`AttributesTabComponent`): Shows an "Edit" button (pencil icon) if `isLayerEditable(graphic)` returns `true`. Clicking it calls `attributeEditStore.startEditing(graphic)`, which replaces the read-only attribute table with the `<rima-edit-form>`.
- **Geometry Tab** (`GeometryTabComponent`): Shows an "Edit Geometry" button if `layer.capabilities.editing.supportsGeometryUpdate` is `true`. Clicking it calls `geometryEditService.startEditing(graphic)`, which activates the sketch tool on the map and shows the geometry edit toolbar.
- **Popup close guard**: When `editEffects.isDirty()` is `true`, closing the popup shows a confirmation dialog ("You have unsaved edits. Are you sure you want to close?") instead of immediately dismissing.
- **Click suppression**: `PopupClickService` ignores all map clicks while `editEffects.editing()` is `true`, preventing accidental popup changes during an edit session.

---

## Error Handling

| Error Class        | Base Class         | Scenario                                                  |
| ------------------ | ------------------ | --------------------------------------------------------- |
| `EditSaveError`    | `RecoverableError` | `applyEdits()` fails or returns an error result.          |
| `EditRefreshError` | `SilentError`      | Re-querying the layer after an edit fails (non-critical). |
