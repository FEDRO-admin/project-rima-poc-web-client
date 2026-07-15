h1. Application Startup

_Task:_ 604
_Branch:_ feature/585-3D_view
_Date:_ July 2026

---

h2. Executive Summary

The RIMA web application launches in a single page and displays an interactive map of Switzerland powered by Esri ArcGIS and Swisstopo basemaps. On load, the system authenticates with the FEDRO ArcGIS Portal, retrieves the configured layer catalog for the active language (German by default), and renders the map with all operational layers. The application also initialises several domain workflows—feature creation, editing, deletion, popup inspection, hierarchy navigation, and historical versioning—so that they are ready the instant a user interacts with the map. If anything goes wrong during startup, a translated error page is shown.

---

h2. Technical Startup Sequence

The application starts by bootstrapping {{AppComponent}} with a set of globally registered providers. This process is entirely synchronous and completes before any route is activated.

As part of this bootstrap, an {{AppEffectsService}} is eagerly constructed via {{provideAppInitializer()}}. It instantiates the following reactive effect services, all of which register their Angular reactive callbacks in their constructors:

||Effect Service||Responsibility||
|{{LanguageEffect}}|Keeps Transloco in sync with the active language signal|
|{{PopupEffects}}|Attaches the map click handler, manages selection/hover highlights|
|{{EditEffects}}|Refreshes the popup when the underlying feature is edited|
|{{CreateEffects}}|Closes the popup and cancels active edits when feature creation starts|
|{{DeleteEffects}}|Exposes a deletion state signal for coordinating across the app|
|{{HierarchyEffects}}|Loads the parent/child hierarchy tree when a feature is selected|
|{{HistoryEffects}}|Closes popup, cancels edits/creates, and manages historic moment state|

On first run the {{LanguageEffect}} triggers an asynchronous HTTP request to load the default German translation file ({{/i18n/de.json}}); this load proceeds in the background and does not block the rest of startup.

Once the shell renders, the router immediately activates the default route and lazily loads {{MapComponent}}. The map template contains four child components:

- {{arcgis-map}} — the ArcGIS web component
- {{rima-toc}} — Table of Contents with layer list, zoom-to, create actions, and history picker
- {{rima-popup}} — custom popup for feature inspection (attributes, hierarchy, etc.)
- {{rima-create-form}} / {{rima-edit-form}} — side-panel forms for feature creation and editing

{{MapComponent}}'s constructor registers a reactive effect on the {{arcgis-map}} custom element reference. As soon as Angular resolves that element in the DOM, the effect fires and the following steps execute in strict order:

# _MapView registration_ — the ArcGIS {{MapView}} instance provided by the web component is stored in {{MapViewService}} as a signal. Any component watching this signal is notified immediately (e.g. {{PopupEffects}} attaches its click handler, {{TocComponent}} binds its layer list).

# _Basemap setup_ — a {{WMTSLayer}} pointing to the Swisstopo Pixelkarte ({{wmts.geo.admin.ch}}) is assigned as the map basemap synchronously. The ArcGIS SDK loads the WMTS capabilities document in the background.

# _Map readiness_ — execution waits until the ArcGIS {{MapView}} has completed its internal initialisation.

# _Catalog build_ — {{CatalogService.buildMapCatalog()}} queries the ArcGIS Enterprise Portal for all Web Map items belonging to the active language category. Each Web Map is loaded in parallel, its layers are filtered to the permitted types ({{ArcGISFeatureLayer}}, {{WebTiledLayer}}, {{MapImageLayer}}), and the results are assembled into a hierarchical {{Catalog}} tree. The {{CatalogStore}} tracks the load state ({{loading}} → {{loaded}} or {{error}}) throughout this process.

# _Layer addition_ — {{LayerService.addCatalogToMap()}} traverses the catalog tree and creates the corresponding ArcGIS SDK layer objects ({{FeatureLayer}}, {{WMTSLayer}}, {{MapImageLayer}}, {{GroupLayer}}), then adds them all to the map in a single call. Catalog items of type {{document}} are skipped. The ArcGIS SDK handles subsequent data loading asynchronously.

At the end of step 5 the map is fully operational and visible to the user.

h2. Error Classification

Errors are handled globally by {{ErrorHandlerService}} (Angular's ErrorHandler):

||Category||Behaviour||Examples||
|_SilentError_|Logged in dev mode only; no UI feedback|{{MapViewAlreadyRegisteredError}}, {{PopupInitialisationError}}, {{PopupHighlightError}}, {{EditRefreshError}}|
|_RecoverableError_|Logged; no navigation away from the app|{{CatalogWebMapLoadError}}, {{CreateSaveError}}, {{DeleteFeatureError}}, {{EditSaveError}}, {{HistoryError}}, {{ReferencePointSaveError}}|
|_FatalError_|Navigates to {{/error}} with a translated message|{{PortalLoadError}}, {{WebmapLanguageCategoryMissingError}}, {{ViewInitialisationError}}, {{LayerAddError}}, {{LayerBuildError}}, {{MapViewInitialiseError}}, {{CatalogSchemaLoadError}}|
