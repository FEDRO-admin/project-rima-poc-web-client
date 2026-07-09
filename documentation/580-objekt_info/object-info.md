h1. Object Info (Popup)

_Task:_ 580
_Branch:_ feature/585-3D_view
_Date:_ July 2026

---

h2. Executive Summary

The Object Info system displays detailed information about map features when a user clicks on them. It supports multi-feature selection, tabbed detail views (attributes, hierarchy, documents), highlight management, and actions to edit or delete features directly from the popup. The system replaces the ArcGIS SDK's built-in popup with a fully custom Angular implementation.

---

h2. Overview

The Object Info system (internally called "Popup") displays detailed information about map features when a user clicks on them. It replaces the ArcGIS SDK's built-in popup with a custom Angular implementation that supports multi-feature selection, tabbed detail views, highlight management, feature editing, and feature deletion.

The popup appears as a card overlay within the map container. It can display either a list of features (when multiple features are hit at the click location) or a detailed view of a single selected feature. The detail view uses a tabbed layout with Attributes, Hierarchy, and Documents tabs. Edit and Delete actions are launched directly from the popup header (see [583-editing|../583-editing/editing.md]).

---

h2. Architecture

The popup system consists of the following cooperating units:

||Unit||Role||
|{{PopupStore}}|NgRx SignalStore managing popup visibility, the graphics array, selected/hovered index, and derived computed signals.|
|{{PopupEffects}}|Root-provided service that wires up reactive effects: attaches the click handler, manages highlights on selection/hover, and clears highlights on close.|
|{{PopupService}}|Unified service handling click attachment, hit-testing, highlight management, and feature refresh. Merges the former {{PopupClickService}} and {{PopupHighlightService}} into a single injectable.|
|{{PopupComponent}}|The UI container rendering the popup card (header with Edit/Delete actions, feature list, detail view, delete confirmation dialog).|
|{{PopupContentComponent}}|Child component rendering the tabbed detail view for a single selected graphic (attributes, hierarchy, documents).|
|{{AttributesTabComponent}}|Read-only attribute table with non-immutable fields and a collapsible "Immutable" section for system fields.|
|{{HierarchyTabComponent}}|Displays the full relationship tree for the selected feature: parent chain, the selected feature itself, and children (recursive). Clicking a node flashes and highlights it on the map.|
|{{HierarchyStore}}|NgRx SignalStore tracking the graphic under inspection, the loaded tree, and load state ({{idle}} / {{loading}} / {{loaded}} / {{error}}).|
|{{HierarchyService}}|Builds the {{HierarchyNode}} tree by querying ArcGIS relationships (parent chain via {{destination}} roles, children via {{origin}} roles).|
|{{HierarchyEffects}}|Reactive effect that triggers {{HierarchyService.buildHierarchyTree()}} whenever {{HierarchyStore.graphic()}} changes.|
|{{DocumentsTabComponent}}|Placeholder — "Documents view coming soon."|

---

h2. State Management (PopupStore)

The {{PopupStore}} is an NgRx SignalStore with the following state:

{code}
PopupState {
graphics: Graphic[] // all features at the click location
selectedIndex: number | undefined // index of the feature being viewed
hoveredIndex: number | undefined // index of the feature being hovered in the list
visible: boolean // whether the popup card is shown
}
{code}

h3. Computed signals

||Signal||Derivation||
|{{selectedGraphic}}|{{graphics[selectedIndex]}} or {{undefined}}|
|{{showList}}|{{visible && selectedIndex == null}} (multiple features, none selected yet)|
|{{showDetail}}|{{visible && selectedIndex != null}} (single feature view)|

h3. Methods

||Method||Behaviour||
|{{open(graphics)}}|If one graphic: sets {{selectedIndex = 0}} (jump straight to detail). If multiple: leaves {{selectedIndex = undefined}} (shows list). Sets {{visible = true}}.|
|{{selectFeature(index)}}|Navigates from list to detail view for the given feature. Also clears {{hoveredIndex}}.|
|{{backToList()}}|Returns from detail view to the feature list (resets {{selectedIndex}}).|
|{{hoverFeature(index)}}|Sets the hovered index (or {{undefined}} to clear). Used for highlight feedback.|
|{{close()}}|Resets all state to initial values. Clears graphics, indices, and hides the popup.|
|{{replaceSelectedGraphic(graphic)}}|Replaces the graphic at the current {{selectedIndex}} in the graphics array.|

---

h2. Popup Effects (PopupEffects)

{{PopupEffects}} is a root-provided service that centralises all reactive side effects for the popup system. It injects {{PopupService}}, {{PopupStore}}, and {{MapViewService}}, and sets up four effects in its constructor:

# _attachClickHandler()_ — Watches {{MapViewService.mapView()}}. When a view becomes available, calls {{popupService.attach(view)}} inside {{untracked()}}.

# _highlightSelected()_ — Watches {{popupStore.selectedGraphic()}}. Clears the previous selection highlight and applies a new one via {{popupService.highlightGraphic(graphic, 'selection')}}.

# _highlightHovered()_ — Watches {{popupStore.hoveredIndex()}}. Clears the previous hover highlight and applies a new one for the hovered graphic.

# _clearHighlight()_ — Watches {{popupStore.visible()}}. When {{false}}, clears both hover and selection highlights.

---

h2. Click Handling & Highlight Management (PopupService)

{{PopupService}} is a root-provided injectable that consolidates click attachment, hit-testing, and highlight management (previously split across {{PopupClickService}} and {{PopupHighlightService}}):

h3. Click handling

# {{attach(view)}} disables the SDK's built-in popup ({{view.popupEnabled = false}}) and registers a {{view.on('click', ...)}} handler.

# On click, {{handleClick()}} checks three active-session guards: if _{{editStore.active()}}_, _{{createStore.active()}}_, or _{{deleteStore.active()}}_ is {{true}}, the click is _ignored_.

# Otherwise, it performs a hit test restricted to all {{FeatureLayer}} instances in the map.

# If one or more graphics are found, {{popupStore.open(graphics)}} is called.

# If no graphics are found, {{popupStore.close()}} is called (dismisses any open popup).

# Cleanup is handled via {{ngOnDestroy()}}, which removes the click handler and clears all highlights.

h3. Highlight management

- _{{highlightGraphic(graphic, type)}}_ — Obtains a {{FeatureLayerView}} via {{view.whenLayerView(graphic.layer)}} and calls {{layerView.highlight(graphic)}}. Stores the handle as either hover or selection. Clears the previous handle of the same type before applying. Throws {{PopupHighlightError}} on failure.
- _{{clearHoverHighlight()}}_ — Removes the hover highlight handle.
- _{{clearSelectionHighlight()}}_ — Removes the selection highlight handle.
- _{{clearAllHighlights()}}_ — Removes both. Also called on {{ngOnDestroy()}}.

h3. Feature refresh

- _{{refreshSelectedGraphic()}}_ — Re-queries the {{FeatureLayer}} for the selected feature's latest attributes and geometry, then calls {{popupStore.replaceSelectedGraphic()}}. Used after edits are saved. Throws {{PopupRefreshError}} on failure.

---

h2. UI Components

h3. PopupComponent (container)

Rendered as {{rima-popup}} inside {{MapComponent}}'s template. It conditionally displays when {{store.visible()}} is {{true}}.

_Header actions (detail view only):_

- Back button (chevron-left) — shown when multiple features exist. Calls {{store.backToList()}}.
- Zoom to button — zooms the map to the selected graphic's geometry at zoom level 15.
- Edit button (pencil icon) — shown when {{isLayerEditable(graphic)}} returns {{true}}. Calls {{editService.activate(graphic)}}, which closes the popup and enters the edit workflow.
- Delete button (trash icon) — shown when {{isLayerDeletable(graphic)}} returns {{true}}. Calls {{deleteService.requestDelete(graphic)}}, which opens the inline delete confirmation dialog.
- Close button (✕) — calls {{requestClose()}}, which calls {{store.close()}} directly (no dirty-check guard).

_List view_ ({{store.showList()}}):

- Shows a title "Features (N)" with the count of hit features.
- Renders a scrollable list of buttons, each showing the layer title and a feature label (derived from {{OBJECTID}}, {{FID}}, {{ID}}, or the first attribute value).
- Click on a list item calls {{store.selectFeature(index)}}.
- Mouse enter/leave calls {{store.hoverFeature(index)}} / {{store.hoverFeature(undefined)}}.

_Detail view_ ({{store.showDetail()}}):

- Renders {{rima-popup-content}} with the selected graphic.

_Delete confirmation_ — when {{deleteStore.confirmRequested()}} is {{true}}, a {{rima-confirm-dialog}} is rendered inline in the popup card with the message "Are you sure you want to delete this feature? This action cannot be undone." Confirmation calls {{deleteService.confirmDelete()}} (which deletes the feature and closes the popup); cancellation calls {{deleteService.cancelDelete()}}.

h3. PopupContentComponent (detail)

Displays the selected feature's information in a tabbed layout. The active tab is managed via a local signal. Three tabs are available:

||Tab||Component||Content||
|_Attributes_|{{AttributesTabComponent}}|Read-only attribute table (non-immutable fields) with a collapsible Immutable section.|
|_Hierarchy_|{{HierarchyTabComponent}}|Interactive relationship tree showing parent chain, selected feature, and recursive children.|
|_Documents_|{{DocumentsTabComponent}}|Placeholder — "Documents view coming soon."|

h3. AttributesTabComponent

- _Read-only_: Displays a key-value table of the feature's non-immutable attributes. Uses {{field.alias}} as labels when field definitions are available. Coded-value domains and subtype names are resolved to human-readable labels via {{resolveFieldDisplayValue()}}.
- _Immutable fields_: Shown in a collapsible section labelled "Immutable", listing system fields such as {{OBJECTID}}, {{SHAPE_LENGTH}}, etc.
- There is no inline edit mode here. Editing is launched from the popup header (pencil icon).

h3. HierarchyTabComponent

Displays the ArcGIS relationship tree for the selected feature. It injects {{HierarchyStore}}, {{HierarchyEffects}}, and {{MapViewService}}.

- _On graphic change_: {{HierarchyStore.setGraphic(graphic)}} is called via a constructor effect. {{HierarchyEffects}} detects the change and triggers {{HierarchyService.buildHierarchyTree()}}.
- _Tree structure_: The tree is composed of {{HierarchyNode}} objects. The root is the earliest ancestor. Group nodes collect children by related layer title (e.g. "Roads (3)"). Leaf nodes represent individual features.
- _On node click_: The corresponding feature is flashed on the map with a blink animation (3 blinks, 150 ms each via {{layerView.highlight()}}) and then remains highlighted until the next click or the tab is destroyed.
- _Load states_: The tab renders a loading indicator during {{isLoading()}}, an error message during {{hasError()}}, a "No hierarchy found" message during {{isEmpty()}}, and the tree when loaded.

---

h2. Hierarchy System (HierarchyStore / HierarchyService / HierarchyEffects)

||Unit||Role||
|{{HierarchyStore}}|SignalStore holding {{graphic}}, {{tree}}, {{loadState}}, and {{error}}. Computed: {{isLoading}}, {{hasError}}, {{isEmpty}}.|
|{{HierarchyService}}|Builds the full {{HierarchyNode}} tree by walking ArcGIS relationships upward (parent chain) and downward (children, recursive).|
|{{HierarchyEffects}}|Root-provided service with one effect: watches {{HierarchyStore.graphic()}} and calls {{buildHierarchyTree()}} on each change.|
|{{HierarchyNode}}|Interface: {{graphic, layerTitle, displayLabel, children, expanded, isClickedFeature, isGroup, childRelationships, loading}}.|

_Parent chain logic_: Traverses {{layer.relationships}} filtered to {{role === 'destination'}} upward until no parent is found.
_Children logic_: Traverses {{layer.relationships}} filtered to {{role === 'origin'}}, groups results by related layer title, recurses into each child's own children.

---

h2. Integration

The popup system is integrated into the map as follows:

- {{PopupComponent}} is imported and rendered by {{MapComponent}} ({{rima-popup}}).
- {{PopupEffects}} is injected by {{AppEffectsService}} to ensure all reactive effects (click handler, highlights) are instantiated at bootstrap.
- {{EditService}} is injected by {{PopupComponent}} to activate edit mode from the header Edit button.
- {{DeleteService}} and {{DeleteStore}} are injected by {{PopupComponent}} to trigger and confirm feature deletion.
- The native ArcGIS popup is disabled ({{view.popupEnabled = false}}) so it does not interfere.
- All communication between services uses the {{PopupStore}} as the single source of truth — no direct service-to-service coupling.
- Map clicks are suppressed during active edit, create, and delete sessions via {{editStore.active()}}, {{createStore.active()}}, and {{deleteStore.active()}} in {{PopupService}}.

---

h2. Keyboard Support

- _Escape_ — calls {{requestClose()}} via {{onEscape()}}. Closes the popup immediately (no dirty-check guard).

---

h2. Error Handling

||Error Class||Base Class||Scenario||
|{{PopupInitialisationError}}|{{SilentError}}|Error during popup initialisation.|
|{{PopupHighlightError}}|{{SilentError}}|Error obtaining a {{FeatureLayerView}} or applying a highlight.|
|{{PopupRefreshError}}|{{SilentError}}|Error re-querying a feature after an edit is saved.|
