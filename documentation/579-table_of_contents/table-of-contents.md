h1. Table of Contents (ToC)

_Task:_ 579
_Branch:_ feature/579-table*of_contents
\_Date:* August 2026

---

h2. Executive Summary

The Table of Contents (ToC) is a sidebar panel that gives users a complete overview of all map layers, lets them toggle layer visibility, zoom to a layer's geographic extent, and initiate feature creation directly from the layer list. It also provides access to the history picker for viewing historical data states.

---

h2. Overview

The Table of Contents is implemented by {{TocComponent}}, which wraps the ArcGIS {{arcgis-layer-list}} web component. It also renders a {{HistoryPickerComponent}} in its footer area for accessing historical versioning.

h2. Initialisation

{{TocComponent}} is rendered as part of {{MapComponent}}'s template and is therefore present in the DOM from the moment the map route activates. However, the {{arcgis-layer-list}} element requires a view reference before it can display anything. The component handles this through a reactive Angular {{effect()}} that watches the {{ViewService.activeView()}} signal. As soon as the [Application Startup|../604-base_web_client_components/application-startup.md] sequence sets the initial view (via {{ViewService.setInitialView()}}), this effect fires and assigns the view to the layer list element.

Inside {{untracked()}}, the effect also sets the {{listItemCreatedFunction}} callback, which is invoked once per layer entry as the list builds itself. It attaches action buttons depending on the layer type:

||Layer Type||Actions||
|{{FeatureLayer}}|Zoom to, Create|
|{{MapImageLayer}}|Zoom to|
|Other (GroupLayer, WMSLayer, WMTSLayer, etc.)|None|

h2. Zoom to Layer

When a user clicks the _Zoom to_ button on a layer entry, {{TocComponent.onTriggerAction()}} is called. It reads the current active view from the {{ViewService.activeView()}} signal, loads the layer to ensure metadata (including {{fullExtent}}) is available, and navigates the view to the layer's spatial extent.

For WMTS layers, which expose their extent via {{layer.activeLayer.fullExtent}} rather than {{layer.fullExtent}} directly, a fallback path is used. If no extent is available, the action is silently ignored.

h2. Create Feature

When a user clicks the _Create_ button on a {{FeatureLayer}} entry, the component guards against creation during history mode ({{HistoryStore.active()}}). It then loads the layer and activates the {{CreateStore}} with the layer reference. This opens the creation form panel and triggers the {{CreateEffects}} (which close any open popup and cancel active edits).
