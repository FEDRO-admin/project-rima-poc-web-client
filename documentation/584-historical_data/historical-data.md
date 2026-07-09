h1. Historical Data Viewer

_Task:_ 584
_Branch:_ feature/585-3D_view
_Date:_ July 2026

---

h2. Executive Summary

The Historical Data Viewer allows users to view map data as it existed at a specific point in the past. Users can select a named historical moment (provided by the server) or enter a custom date and time. When activated, all feature layers on the map switch to showing their historical state. This is a read-only mode — editing, creating, and popup interactions are suspended while viewing historical data.

---

h2. Overview

The Historical Data feature enables time-travel viewing of geodata by applying ArcGIS "historic moments" to all {{FeatureLayer}} instances on the map. It is presented as a {{HistoryPickerComponent}} embedded in the Table of Contents footer, offering two selection modes:

- _Named moments_ — pre-defined server-side snapshots fetched from a RIMA SOE (Server Object Extension) endpoint.
- _Custom date/time_ — a user-specified date and time via Calcite date/time picker components.

When a historic moment is active, the map displays data as it existed at that timestamp. Returning to the present restores all layers to their live state.

---

h2. Architecture

||Unit||Role||
|{{HistoryStore}}|NgRx SignalStore — tracks {{active}} flag and {{selectedDate}}.|
|{{HistoryService}}|Applies or clears {{historicMoment}} on all {{FeatureLayer}} instances in the map.|
|{{HistoryEffects}}|Root effect service — closes popup, cancels edits/creates on activate; clears historic moment on deactivate.|
|{{HistoricMomentsService}}|Fetches named historic moments from the RIMA SOE endpoint via {{esriRequest}}.|
|{{HistoryPickerComponent}}|UI component (in TOC footer) with a dropdown of named moments, custom date/time inputs, and "Return to Present" button.|
|{{history-config.ts}}|{{HistoricMomentEntry}} interface and {{HISTORIC_MOMENTS_URL}} constant.|
|{{history-errors.ts}}|{{HistoryError}} (recoverable).|

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

Fetches named historic moments from the RIMA Server Object Extension:

- _Endpoint:_ {{HISTORIC_MOMENTS_URL}} (configured in {{history-config.ts}})
- _Request:_ {{esriRequest(url, \{ query: \{ f: 'json' \}, responseType: 'json' \})}}
- _Response processing:_
  ** Unwraps any single-key wrapper object.
  ** Filters out the {{DEFAULT}} entry.
  \*\* Returns an array of {{HistoricMomentEntry}} objects with {{name}} and {{date}} (ISO string).
- _Error handling:_ Returns an empty array on failure (does not throw).

---

h2. History Service ({{HistoryService}})

Applies or clears the {{historicMoment}} property on all {{FeatureLayer}} instances currently in the map:

- _{{applyHistoricMoment(date)}}_ — Sets {{layer.historicMoment = date}} and calls {{layer.refresh()}} on every {{FeatureLayer}}.
- _{{clearHistoricMoment()}}_ — Sets {{layer.historicMoment = null}} and calls {{layer.refresh()}} on every {{FeatureLayer}}.

Layers are discovered by traversing {{view.map.allLayers}} and filtering to {{FeatureLayer}} instances.

---

h2. UI ({{HistoryPickerComponent}})

Rendered as {{rima-history-picker}} in the TOC footer. Uses Calcite Design System components.

h3. Layout

- _"Return to Present"_ button — visible only when {{historyStore.active()}} is {{true}}. Shows the currently viewed date. Calls {{historyStore.deactivate()}}.
- _"Historical Moments"_ dropdown — Calcite dropdown that lazy-loads named moments on first open. Each item shows {{name (date)}}. Selecting an item calls {{selectMoment(entry)}}.
- _"Custom Date & Time"_ collapsible section — Expandable area with a {{calcite-input-date-picker}} (locale: de-CH), a {{calcite-input-time-picker}} (24h format, 1-minute step), and an "Apply" button.

h3. Interactions

||Action||Method||Behaviour||
|Select a named moment|{{selectMoment(entry)}}|Parses the date string, stores the entry, calls {{historyStore.activate(date)}} and {{historyService.applyHistoricMoment(date)}}.|
|Apply custom date/time|{{applyCustomDate()}}|Combines the date and time inputs into a {{Date}}, calls {{historyStore.activate(date)}} and {{historyService.applyHistoricMoment(date)}}.|
|Return to present|{{returnToPresent()}}|Clears the selected moment and calls {{historyStore.deactivate()}} (which triggers the {{clearHistoricMomentOnDeactivate}} effect).|
|Dropdown opens|{{onDropdownOpen()}}|Lazy-loads moments from {{HistoricMomentsService}} on first open; shows a loader while fetching.|

---

h2. Integration

- {{HistoryPickerComponent}} is rendered by {{TocComponent}} in its footer area.
- {{HistoryEffects}} is eagerly instantiated by {{AppEffectsService}} at bootstrap.
- While history mode is active:
  ** The popup is closed and cannot be reopened (effects close it on activation).
  ** Edit and create sessions are cancelled.
  \*\* Map clicks still fire but are not affected by {{HistoryEffects}} directly (popup/edit/create guards handle suppression).
- Returning to present triggers {{clearHistoricMoment()}}, which resets all {{FeatureLayer}} instances to their live data.

---

h2. Error Handling

||Error Class||Base Class||Scenario||
|{{HistoryError}}|{{RecoverableError}}|General error in the history subsystem.|

Note: {{HistoricMomentsService}} catches errors internally and returns an empty array rather than propagating failures.
