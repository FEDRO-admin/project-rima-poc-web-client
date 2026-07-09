h1. Historical Data Viewer

_Task:_ 584
_Branch:_ feature/585-3D*view
\_Date:* July 2026

---

h2. Executive Summary

The Historical Data Viewer allows users to view map data as it existed at a specific point in the past. Users can select a named historical moment (provided by the server), enter a custom date and time, or manage (add/delete) named markers via a RIMA Server Object Extension (SOE). When activated, all feature layers on the map switch to showing their historical state, including relationship queries in the hierarchy tab. This is a read-only mode — editing, creating, and popup interactions are suspended while viewing historical data.

---

h2. Overview

The Historical Data feature enables time-travel viewing of geodata by applying ArcGIS "historic moments" to all {{FeatureLayer}} instances on the map. It is presented as a {{HistoryPickerComponent}} embedded in the Table of Contents footer, offering three interaction modes:

- _Named moments_ — pre-defined server-side snapshots fetched from a RIMA SOE endpoint, displayed as a selectable list with delete capability.
- _Add marker_ — create a new named marker by specifying a name, date, and time, persisted to the server via the SOE.
- _Custom date/time_ — a user-specified date and time via Calcite date/time picker components (no server-side marker created).

When a historic moment is active, the map displays data as it existed at that timestamp. The hierarchy tab (relationship queries) also respects the selected timestamp. Returning to the present restores all layers to their live state.

---

h2. Architecture

||Unit||Role||
|{{HistoryStore}}|NgRx SignalStore — tracks {{active}} flag and {{selectedDate}}.|
|{{HistoryService}}|Applies or clears {{historicMoment}} on all {{FeatureLayer}} instances in the map.|
|{{HistoryEffects}}|Root effect service — closes popup, cancels edits/creates on activate; clears historic moment on deactivate.|
|{{HistoricMomentsService}}|Fetches, adds, and deletes named historic moments via the RIMA SOE endpoint using {{esriRequest}}.|
|{{HistoryPickerComponent}}|UI component (in TOC footer) with a list of named moments (with delete), add marker form, custom date/time inputs, and "Return to Present" button.|
|{{history-config.ts}}|{{HistoricMomentEntry}} interface and SOE endpoint URL constants.|
|{{history-errors.ts}}|{{HistoryError}} (recoverable).|

---

h2. SOE Endpoints ({{history-config.ts}})

All endpoints are on the RIMA SOE at {{.../MapServer/exts/RimaSoe/}}:

||Endpoint||Method||Parameters||Response||
|{{getHistoricMoments}}|GET|{{f=json}}|Object with name→timestamp entries (plus a {{DEFAULT}} key which is filtered out).|
|{{addHistoricMoment}}|GET|{{f=json}}, {{name}}, {{timestamp}} (ISO format)|{{{"status": "success"\}}} or {{{"status": "error", "message": "..."\}}}|
|{{delHistoricMoment}}|GET|{{f=json}}, {{name}}|{{{"status": "success"\}}} or {{{"status": "error", "message": "..."\}}}|

All requests use {{esriRequest}} which automatically attaches the portal authentication token.

---

h2. State ({{HistoryStore}})

{code}
HistoryState {
active: boolean // true while viewing historical data
selectedDate: Date | null // the timestamp being viewed
}
{code}

_Methods:_

||Method||Behaviour||
|{{activate(date)}}|Sets {{active = true}} and stores the selected date.|
|{{deactivate()}}|Sets {{active = false}} and clears the date.|
|{{toggle()}}|Flips the {{active}} flag.|
|{{reset()}}|Returns all state to initial values.|

---

h2. History Effects ({{HistoryEffects}})

{{HistoryEffects}} is a root-provided service that registers four reactive effects:

# _closePopupOnActivate()_ — When {{active}} becomes {{true}}, closes the popup ({{popupStore.close()}}).

# _cancelEditsOnActivate()_ — When {{active}} becomes {{true}} and an edit session is running, cancels it ({{editService.reset()}}).

# _cancelCreateOnActivate()_ — When {{active}} becomes {{true}} and a create session is running, cancels it ({{createStore.reset()}}).

# _clearHistoricMomentOnDeactivate()_ — When {{active}} becomes {{false}}, calls {{historyService.clearHistoricMoment()}} to restore all layers to live state.

It also exposes a computed signal {{active}} used for coordination with other parts of the application.

---

h2. Historic Moments Service ({{HistoricMomentsService}})

Communicates with the RIMA SOE to manage named historic moments:

h3. getHistoricMoments()

- _Request:_ {{esriRequest(HISTORIC_MOMENTS_URL, \{ query: \{ f: 'json' \}, responseType: 'json' \})}}
- _Response processing:_
  ** Unwraps any single-key wrapper object.
  ** Filters out the {{DEFAULT}} entry.
  ** Filters to string-valued entries only.
  ** Returns an array of {{HistoricMomentEntry}} objects with {{name}} and {{date}} (ISO string).
- _Error handling:_ Returns an empty array on failure (does not throw).

h3. addHistoricMoment(name, timestamp)

- _Request:_ {{esriRequest(HISTORIC_MOMENTS_ADD_URL, \{ query: \{ f: 'json', name, timestamp \} \})}}
- _Returns:_ {{HistoricMomentResult}} with {{success: boolean}} and optional {{message}}.
- _Error detection:_ Checks {{data['status'] === 'error'}} in the response.

h3. deleteHistoricMoment(name)

- _Request:_ {{esriRequest(HISTORIC_MOMENTS_DELETE_URL, \{ query: \{ f: 'json', name \} \})}}
- _Returns:_ {{HistoricMomentResult}} with {{success: boolean}} and optional {{message}}.
- _Error detection:_ Same as add.

---

h2. History Service ({{HistoryService}})

Applies or clears the {{historicMoment}} property on all {{FeatureLayer}} instances currently in the map:

- _{{applyHistoricMoment(date)}}_ — Sets {{layer.historicMoment = date}} and calls {{layer.refresh()}} on every {{FeatureLayer}}.
- _{{clearHistoricMoment()}}_ — Sets {{layer.historicMoment = null}} and calls {{layer.refresh()}} on every {{FeatureLayer}}.

Layers are discovered by traversing {{view.map.allLayers}} and filtering to {{FeatureLayer}} instances.

---

h2. Hierarchy Integration

The {{HierarchyService}} (popup hierarchy tab) respects the active historic moment. When building the hierarchy tree, both {{queryParent}} and {{queryChildren}} pass {{historicMoment: historyStore.selectedDate()}} into their {{RelationshipQuery}} objects. This ensures that relationship navigation shows the relationships as they existed at the selected timestamp.

When not in history mode ({{selectedDate}} is {{null}}), the {{historicMoment}} parameter is {{undefined}} and queries return current-state relationships.

---

h2. UI ({{HistoryPickerComponent}})

Rendered as {{rima-history-picker}} in the TOC footer. Uses Calcite Design System components.

h3. Layout

- _"Return to Present"_ button — visible only when {{historyStore.active()}} is {{true}}. Shows the currently viewed date ({{dd.MM.yyyy HH:mm}}). Calls {{returnToPresent()}}.
- _"Historical Moments"_ expandable panel — toggles on button click; lazy-loads named moments on first open. Shows a {{calcite-list}} of named moments. Each list item displays name and formatted date, is clickable to activate, and has a trash icon button to delete.
- _Delete confirmation_ — inline confirmation prompt ("Delete 'name'?") with Cancel/Delete buttons.
- _"Add Marker"_ button and form — expands an inline form with name input ({{calcite-input-text}}), date picker ({{calcite-input-date-picker}}, locale: de-CH), time picker ({{calcite-input-time-picker}}, 24h, 1-minute step), and Save/Cancel buttons.
- _Error notice_ — a closable {{calcite-notice}} (kind: danger) appears when add/delete operations fail, showing the server's error message.
- _"Custom Date & Time"_ collapsible section — independent from marker management. Expandable area with date picker, time picker, and "Apply" button to view a specific moment without creating a server-side marker.

h3. Interactions

||Action||Method||Behaviour||
|Toggle panel|{{togglePanel()}}|Opens/closes the moments panel; lazy-loads on first open.|
|Select a named moment|{{selectMoment(entry)}}|Parses the date string, stores the entry, calls {{historyStore.activate(date)}} and {{historyService.applyHistoricMoment(date)}}.|
|Delete a marker|{{confirmDelete(entry)}} → {{executeDelete()}}|Shows confirmation, then calls {{historicMomentsService.deleteHistoricMoment(name)}} and refreshes the list.|
|Add a marker|{{showAddForm()}} → {{submitAdd()}}|Collects name/date/time, calls {{historicMomentsService.addHistoricMoment(name, timestamp)}} and refreshes the list.|
|Apply custom date/time|{{applyCustomDate()}}|Combines the date and time inputs into a {{Date}}, calls {{historyStore.activate(date)}} and {{historyService.applyHistoricMoment(date)}}.|
|Return to present|{{returnToPresent()}}|Clears the selected moment and calls {{historyStore.deactivate()}} (which triggers the {{clearHistoricMomentOnDeactivate}} effect).|

h3. Change Detection

Since {{esriRequest}} resolves outside Angular's zone, the component injects {{ChangeDetectorRef}} and calls {{detectChanges()}} after async operations (load, add, delete) to ensure the template updates.

---

h2. Integration

- {{HistoryPickerComponent}} is rendered by {{TocComponent}} in its footer area.
- {{HistoryEffects}} is eagerly instantiated by {{AppEffectsService}} at bootstrap.
- While history mode is active:
  ** The popup is closed and cannot be reopened (effects close it on activation).
  ** Edit and create sessions are cancelled.
  ** Map clicks still fire but are not affected by {{HistoryEffects}} directly (popup/edit/create guards handle suppression).
  ** Hierarchy tab queries include the {{historicMoment}} parameter.
- Returning to present triggers {{clearHistoricMoment()}}, which resets all {{FeatureLayer}} instances to their live data.

---

h2. Error Handling

||Error Class||Base Class||Scenario||
|{{HistoryError}}|{{RecoverableError}}|General error in the history subsystem.|

{{HistoricMomentsService}} handles errors as follows:

- {{getHistoricMoments()}} — catches errors internally, returns an empty array.
- {{addHistoricMoment()}} / {{deleteHistoricMoment()}} — returns a {{HistoricMomentResult}} with {{success: false}} and the server's error message. The UI displays this in a closable {{calcite-notice}}.
