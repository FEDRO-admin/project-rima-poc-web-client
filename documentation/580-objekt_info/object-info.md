# Object Info (Popup)

**Task:** 580  
**Branch:** feature/580-objekt-info  
**Date:** June 2026

---

## Overview

The Object Info system (internally called "Popup") displays detailed information about map features when a user clicks on them. It replaces the ArcGIS SDK's built-in popup with a custom Angular implementation that supports multi-feature selection, tabbed detail views, and highlight management.

The popup appears as a card overlay within the map container. It can display either a list of features (when multiple features are hit at the click location) or a detailed view of a single selected feature.

---

## Architecture

The popup system consists of four cooperating units:

| Unit                    | Role                                                                                                                                    |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `PopupStore`            | NgRx SignalStore managing popup visibility, the graphics array, selected/hovered index, and derived computed signals.                   |
| `PopupClickService`     | Attaches a click handler to the MapView. Performs a hit test against all FeatureLayers and opens the popup with the resulting graphics. |
| `PopupHighlightService` | Reactively highlights graphics on the map based on selection and hover state in the store.                                              |
| `PopupComponent`        | The UI component rendering the popup card (header, feature list, detail view).                                                          |
| `PopupContentComponent` | Child component rendering the tabbed detail view for a single selected graphic (attributes, hierarchy, documents).                      |

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

| Method                 | Behaviour                                                                                                                                                |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `open(graphics)`       | If one graphic: sets `selectedIndex = 0` (jump straight to detail). If multiple: leaves `selectedIndex = undefined` (shows list). Sets `visible = true`. |
| `selectFeature(index)` | Navigates from list to detail view for the given feature.                                                                                                |
| `backToList()`         | Returns from detail view to the feature list (resets `selectedIndex`).                                                                                   |
| `hoverFeature(index)`  | Sets the hovered index (or `undefined` to clear). Used for highlight feedback.                                                                           |
| `close()`              | Resets all state to initial values. Clears graphics, indices, and hides the popup.                                                                       |

---

## Click Handling (PopupClickService)

`PopupClickService` is a root-provided injectable that reactively attaches to the MapView:

1. An Angular `effect()` watches `MapViewService.mapView()`. When a view becomes available, it calls `attach(view)`.
2. `attach()` disables the SDK's built-in popup (`view.popupEnabled = false`) and registers a `view.on('click', ...)` handler.
3. On click, `handleClick()` performs a hit test restricted to all `FeatureLayer` instances in the map.
4. If one or more graphics are found, `popupStore.open(graphics)` is called.
5. If no graphics are found, `popupStore.close()` is called (dismisses any open popup).
6. Cleanup is handled via `DestroyRef.onDestroy()`, which removes the click handler.

---

## Highlight Management (PopupHighlightService)

`PopupHighlightService` is a root-provided injectable that manages two independent highlight handles on the map:

- **Selection highlight** — tracks `popupStore.selectedGraphic()`. When a graphic is selected, its feature is highlighted on the map via `layerView.highlight(graphic)`. When selection changes, the previous highlight is removed.
- **Hover highlight** — tracks `popupStore.hoveredIndex()`. When the user hovers over a feature in the list view, that feature is highlighted on the map. Cleared when the mouse leaves.
- **Visibility** — when `popupStore.visible()` becomes `false`, all highlights are cleared.

Both highlights use the ArcGIS SDK's `FeatureLayerView.highlight()` method, which renders a blue outline/fill around the feature on the map.

---

## UI Components

### PopupComponent (container)

Rendered as `<rima-popup>` inside `MapComponent`'s template. It conditionally displays when `store.visible()` is `true`.

**Header actions:**

- Back button (chevron-left) — shown in detail view when multiple features exist. Calls `store.backToList()`.
- Zoom to button — zooms the map to the selected graphic's geometry at zoom level 15.
- Close button — dismisses the popup. Also triggered by pressing Escape (via `@HostListener('document:keydown.escape')`).

**List view** (`store.showList()`):

- Shows a title "Features (N)" with the count of hit features.
- Renders a scrollable list of buttons, each showing the layer title and a feature label (derived from `OBJECTID`, `FID`, `ID`, or the first attribute value).
- Click on a list item calls `store.selectFeature(index)`.
- Mouse enter/leave calls `store.hoverFeature(index)` / `store.hoverFeature(undefined)`.

**Detail view** (`store.showDetail()`):

- Renders `<rima-popup-content [graphic]="store.selectedGraphic()!">`.

### PopupContentComponent (detail)

Displays the selected feature's information in a tabbed layout:

| Tab            | Content                                                                                                                                                      |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Attributes** | A key-value table of the feature's attributes. If the layer has field definitions, uses `field.alias` as labels; otherwise falls back to raw attribute keys. |
| **Hierarchy**  | Placeholder — "Hierarchy view coming soon."                                                                                                                  |
| **Documents**  | Placeholder — "Documents view coming soon."                                                                                                                  |

The active tab is managed via a local `signal<PopupTab>('attributes')`.

---

## Integration

The popup system is integrated into the map as follows:

- `PopupComponent` is imported and rendered by `MapComponent` (`<rima-popup>`).
- `PopupClickService` and `PopupHighlightService` are injected by `PopupComponent` to ensure they are instantiated when the popup is rendered. They self-attach to the MapView via reactive effects.
- The native ArcGIS popup is disabled (`view.popupEnabled = false`) so it does not interfere.
- All communication between services uses the `PopupStore` as the single source of truth — no direct service-to-service coupling.

---

## Keyboard Support

- **Escape** — closes the popup from any state (list or detail view). Handled by a `@HostListener` on the document.
