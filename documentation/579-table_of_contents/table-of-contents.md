# Table of Contents (ToC)

**Task:** 579  
**Branch:** feature/579-table_of_contents  
**Date:** June 2026

---

The Table of Contents is implemented by `TocComponent`, which wraps the ArcGIS `arcgis-layer-list` web component (`<arcgis-layer-list>`).

## Initialisation

`TocComponent` is rendered as part of `MapComponent`'s template and is therefore present in the DOM from the moment the map route activates. However, the `arcgis-layer-list` element requires a `MapView` reference before it can display anything. The component handles this through a reactive Angular `effect()` that watches the `MapViewService.mapView()` signal. As soon as step 1 of the [Application Startup](../604-base_web_client_components/application-startup.md) sequence completes (MapView registration), this effect fires and assigns the view to the list element:

```
layerList.view = mapView
layerList.listItemCreatedFunction = fn
```

The `listItemCreatedFunction` callback is invoked once per layer entry as the list builds itself. For each `FeatureLayer` or `WMTSLayer` entry it attaches a _Zoom to_ action button in the layer's action section.

## Zoom to Layer

When a user clicks the _Zoom to_ button on a layer entry, `TocComponent.onTriggerAction()` is called. It reads the current `MapView` from the signal, ensures the layer is fully loaded by awaiting `layer.load()`, and then calls `view.goTo()` with the layer's spatial extent. For WMTS layers, which expose their extent via `layer.activeLayer.fullExtent` rather than `layer.fullExtent` directly, a fallback path is used.
