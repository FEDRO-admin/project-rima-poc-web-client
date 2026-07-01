# Object Info (Popup)

**Task:** 580  
**Branch:** feature/580-objekt-info  
**Date:** June 2026

---

## Overview

The Object Info system (internally called "Popup") displays detailed information about map features when a user clicks on them. It replaces the ArcGIS SDK's built-in popup with a custom Angular implementation that supports multi-feature selection, tabbed detail views, highlight management, and inline feature editing.

The popup appears as a card overlay within the map container. It can display either a list of features (when multiple features are hit at the click location) or a detailed view of a single selected feature. The detail view uses a tabbed layout with Attributes, Geometry, Hierarchy, and Documents tabs. Editing of attributes and geometry is available directly within the respective tabs (see [583-editing](../583-editing/editing.md)).

---

## Architecture

The popup system consists of the following cooperating units:

| Unit                     | Role                                                                                                                                                                                |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PopupStore`             | NgRx SignalStore managing popup visibility, the graphics array, selected/hovered index, and derived computed signals.                                                               |
| `PopupEffects`           | Root-provided service that wires up reactive effects: attaches the click handler, manages highlights on selection/hover, and clears highlights on close.                            |
| `PopupClickService`      | Attaches a click handler to the MapView. Performs a hit test against all FeatureLayers and opens the popup with the resulting graphics. Ignores clicks during active edit sessions. |
| `PopupHighlightService`  | Manages two independent highlight handles (selection and hover) on the map via `FeatureLayerView.highlight()`.                                                                      |
| `PopupComponent`         | The UI container rendering the popup card (header, feature list, detail view). Handles close guard for unsaved edits.                                                               |
| `PopupContentComponent`  | Child component rendering the tabbed detail view for a single selected graphic (attributes, geometry, hierarchy, documents).                                                        |
| `AttributesTabComponent` | Displays a read-only attribute table with system field collapsible section. Provides an "Edit" button to enter inline attribute editing.                                            |
| `GeometryTabComponent`   | Displays geometry metadata (type, length, area). Provides an "Edit Geometry" button to activate the sketch-based geometry editor.                                                   |
| `HierarchyTabComponent`  | Placeholder — "Hierarchy view coming soon."                                                                                                                                         |
| `DocumentsTabComponent`  | Placeholder — "Documents view coming soon."                                                                                                                                         |

---

## State Management (PopupStore)

The `PopupStore` is an NgRx SignalStore with the following state:

```
PopupState {
  graphics: Graphic[]             // all features at the click location
  selectedIndex: number | undefined   // index of the feature being viewed
  hoveredIndex: number | undefined    // index of the feature being hovered in the list
  visible: boolean                    // whether the popup card is shown
}
```

### Computed signals

| Signal            | Derivation                                                                |
| ----------------- | ------------------------------------------------------------------------- |
| `selectedGraphic` | `graphics[selectedIndex]` or `undefined`                                  |
| `showList`        | `visible && selectedIndex == null` (multiple features, none selected yet) |
| `showDetail`      | `visible && selectedIndex != null` (single feature view)                  |

### Methods

| Method                            | Behaviour                                                                                                                                                  |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `open(graphics)`                  | If one graphic: sets `selectedIndex = 0` (jump straight to detail). If multiple: leaves `selectedIndex = undefined` (shows list). Sets `visible = true`.   |
| `selectFeature(index)`            | Navigates from list to detail view for the given feature.                                                                                                  |
| `backToList()`                    | Returns from detail view to the feature list (resets `selectedIndex`).                                                                                     |
| `hoverFeature(index)`             | Sets the hovered index (or `undefined` to clear). Used for highlight feedback.                                                                             |
| `close()`                         | Resets all state to initial values. Clears graphics, indices, and hides the popup.                                                                         |
| `replaceSelectedGraphic(graphic)` | Replaces the graphic at the current `selectedIndex` in the graphics array.                                                                                 |
| `refreshSelectedGraphic()`        | Re-queries the FeatureLayer for the selected feature's latest attributes and geometry, then replaces it in the graphics array. Used after edits are saved. |

---

## Popup Effects (PopupEffects)

`PopupEffects` is a root-provided service that centralises all reactive side effects for the popup system. It injects `PopupClickService`, `PopupHighlightService`, `PopupStore`, and `MapViewService`, and sets up four effects in its constructor:

1. **`attachClickHandler()`** — Watches `MapViewService.mapView()`. When a view becomes available, calls `popupClickService.attach(view)` inside `untracked()`.
2. **`highlightSelected()`** — Watches `popupStore.selectedGraphic()`. Clears the previous selection highlight and applies a new one via `popupHighlightService.highlightGraphic(graphic, 'selection')`.
3. **`highlightHovered()`** — Watches `popupStore.hoveredIndex()`. Clears the previous hover highlight and applies a new one for the hovered graphic.
4. **`clearHighlight()`** — Watches `popupStore.visible()`. When `false`, clears both hover and selection highlights.

---

## Click Handling (PopupClickService)

`PopupClickService` is a root-provided injectable:

1. `attach(view)` disables the SDK's built-in popup (`view.popupEnabled = false`) and registers a `view.on('click', ...)` handler.
2. On click, `handleClick()` first checks `editEffects.editing()` — if an edit session is active, the click is **ignored** to prevent accidental popup changes.
3. Otherwise, it performs a hit test restricted to all `FeatureLayer` instances in the map.
4. If one or more graphics are found, `popupStore.open(graphics)` is called.
5. If no graphics are found, `popupStore.close()` is called (dismisses any open popup).
6. Cleanup is handled via `DestroyRef.onDestroy()`, which removes the click handler.

---

## Highlight Management (PopupHighlightService)

`PopupHighlightService` is a root-provided injectable that manages two independent highlight handles on the map:

- **`highlightGraphic(graphic, type)`** — Obtains a `FeatureLayerView` via `view.whenLayerView(graphic.layer)` and calls `layerView.highlight(graphic)`. Stores the handle as either hover or selection. Clears the previous handle of the same type before applying. Throws `PopupHighlightError` on failure.
- **`clearHoverHighlight()`** — Removes the hover highlight handle.
- **`clearSelectionHighlight()`** — Removes the selection highlight handle.
- **`clearAllHighlights()`** — Removes both. Also called on `DestroyRef.onDestroy()`.

Both highlights use the ArcGIS SDK's `FeatureLayerView.highlight()` method, which renders a blue outline/fill around the feature on the map.

---

## UI Components

### PopupComponent (container)

Rendered as `<rima-popup>` inside `MapComponent`'s template. It conditionally displays when `store.visible()` is `true`.

**Header actions:**

- Back button (chevron-left) — shown in detail view when multiple features exist. Calls `store.backToList()`.
- Zoom to button — zooms the map to the selected graphic's geometry at zoom level 15.
- Close button (✕) — calls `requestClose()`, which checks `editEffects.isDirty()`. If dirty, a confirmation dialog is shown ("You have unsaved edits. Are you sure you want to close?"). If not dirty, closes immediately.

**List view** (`store.showList()`):

- Shows a title "Features (N)" with the count of hit features.
- Renders a scrollable list of buttons, each showing the layer title and a feature label (derived from `OBJECTID`, `FID`, `ID`, or the first attribute value).
- Click on a list item calls `store.selectFeature(index)`.
- Mouse enter/leave calls `store.hoverFeature(index)` / `store.hoverFeature(undefined)`.

**Detail view** (`store.showDetail()`):

- Renders `<rima-popup-content [graphic]="store.selectedGraphic()!">`.

### PopupContentComponent (detail)

Displays the selected feature's information in a tabbed layout. The active tab is managed via a local `signal<PopupTab>('attributes')`. The Geometry tab is only shown if the graphic has a geometry.

| Tab            | Component                | Content                                                                                                           |
| -------------- | ------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| **Attributes** | `AttributesTabComponent` | Read-only attribute table (or inline edit form when editing). See below.                                          |
| **Geometry**   | `GeometryTabComponent`   | Geometry info table (type, length, area) or inline geometry editor. Only visible when the graphic has a geometry. |
| **Hierarchy**  | `HierarchyTabComponent`  | Placeholder — "Hierarchy view coming soon."                                                                       |
| **Documents**  | `DocumentsTabComponent`  | Placeholder — "Documents view coming soon."                                                                       |

### AttributesTabComponent

- **Read mode**: Displays a key-value table of the feature's attributes. Uses `field.alias` as labels when field definitions are available. Coded-value domains and subtype names are resolved to human-readable labels. System fields are shown in a collapsible `<details>` section at the bottom.
- **Edit button**: Shown when `isLayerEditable(graphic)` returns `true`. Calls `attributeEditStore.startEditing(graphic)`.
- **Edit mode**: Replaces the attribute table with `<rima-edit-form>`, the attribute editing form component (see [583-editing](../583-editing/editing.md)).

### GeometryTabComponent

- **Read mode**: Displays a table with geometry type, and length/area values extracted from system attributes (`SHAPE_LENGTH`, `SHAPE_AREA`, etc.).
- **Edit button**: Shown when `layer.capabilities.editing.supportsGeometryUpdate` is `true`. Calls `geometryEditService.startEditing(graphic)`.
- **Edit mode**: Replaces the info table with `<rima-geometry-edit-form>`, the geometry editing form component (see [583-editing](../583-editing/editing.md)).

---

## Integration

The popup system is integrated into the map as follows:

- `PopupComponent` is imported and rendered by `MapComponent` (`<rima-popup>`).
- `PopupEffects` is injected by `PopupComponent` to ensure all reactive effects (click handler, highlights) are instantiated when the popup is rendered.
- `EditEffects` is injected by `PopupComponent` to access the `isDirty()` signal for the close guard.
- The native ArcGIS popup is disabled (`view.popupEnabled = false`) so it does not interfere.
- All communication between services uses the `PopupStore` as the single source of truth — no direct service-to-service coupling.
- Map clicks are suppressed during active edit sessions via `editEffects.editing()` in `PopupClickService`.

---

## Keyboard Support

- **Escape** — calls `requestClose()` via `onEscape()`. If edits are dirty, shows a confirmation dialog; otherwise closes the popup immediately.

---

## Error Handling

| Error Class                | Base Class   | Scenario                                                      |
| -------------------------- | ------------ | ------------------------------------------------------------- |
| `PopupInitialisationError` | `FatalError` | Error during popup initialisation.                            |
| `PopupHighlightError`      | `FatalError` | Error obtaining a `FeatureLayerView` or applying a highlight. |
