h1. Feature Delete

_Task:_ 656
_Branch:_ feature/585-3D_view
_Date:_ July 2026

---

h2. Executive Summary

The Delete system allows users to permanently remove a map feature after a confirmation step. It is triggered from the popup header and requires no separate form — the user simply confirms the deletion inline within the popup card, and the feature is removed from the ArcGIS Portal.

---

h2. Overview

The Delete system allows users to permanently remove a feature from its {{FeatureLayer}}. It is triggered from the _popup header_ via a trash icon and is intentionally minimal: a confirmation dialog is shown inline within the popup before any destructive action is taken.

There is no standalone form component — the entire delete interaction lives inside {{PopupComponent}} and is orchestrated by {{DeleteService}} and {{DeleteStore}}.

Delete capability is checked at runtime via {{isLayerDeletable(graphic)}} in {{layer/layer-capabilities.ts}}, which requires {{layer.editingEnabled}} and {{capabilities.operations.supportsDelete}}.

---

h2. Architecture

||Unit||Role||
|{{DeleteStore}}|NgRx SignalStore — holds the pending {{graphic}}, a {{deleting}} in-flight flag, and a {{confirmRequested}} flag.|
|{{DeleteService}}|{{requestDelete()}}, {{confirmDelete()}} ({{applyEdits(\{ deleteFeatures \})}}), {{cancelDelete()}}.|
|{{DeleteEffects}}|Root effect service — exposes the {{deleting}} computed signal used for click suppression.|
|{{delete-errors.ts}}|{{DeleteFeatureError}} (recoverable).|
|{{PopupComponent}}|Renders the trash icon button and the inline {{rima-confirm-dialog}} when {{deleteStore.confirmRequested()}} is {{true}}.|
|{{layer/layer-capabilities.ts}}|{{isLayerDeletable(graphic)}} — checks {{editingEnabled}} and {{supportsDelete}}.|

---

h2. State ({{DeleteStore}})

{code}
DeleteState {
graphic: Graphic | null
deleting: boolean // true while applyEdits is in-flight
confirmRequested: boolean // true while waiting for user confirmation
}
{code}

_Computed signal:_

||Signal||Derivation||
|{{active}}|{{graphic != null}}|

_Methods:_

||Method||Behaviour||
|{{requestDelete(graphic)}}|Stores the pending graphic and sets {{confirmRequested = true}}.|
|{{setDeleting(boolean)}}|Toggles the in-flight flag.|
|{{reset()}}|Returns all state to initial values.|

---

h2. Flow

h3. 1. Capability check

The popup header shows a trash icon only when {{isLayerDeletable(graphic)}} returns {{true}}:

- {{layer}} is a {{FeatureLayer}}.
- {{layer.editingEnabled === true}}.
- {{layer.capabilities.operations.supportsDelete === true}}.

h3. 2. Request

Clicking the trash icon calls {{PopupComponent.startDelete()}}, which calls {{DeleteService.requestDelete(graphic)}}:

- Stores the graphic in {{DeleteStore}}.
- Sets {{confirmRequested = true}}.

The popup immediately renders an inline {{rima-confirm-dialog}}:

{quote}
_"Are you sure you want to delete this feature? This action cannot be undone."_

Actions: _Delete_ | _Cancel_
{quote}

h3. 3. Confirm

{{PopupComponent.onDeleteConfirm(true)}} calls {{DeleteService.confirmDelete()}}:

# Sets {{deleting = true}}.

# Resolves the {{objectIdField}} from the layer.

# Calls {{layer.applyEdits(\{ deleteFeatures: [\{ [objectIdField]: objectId \}] \})}}.

# On success:

#_ Calls {{layer.refresh()}} to update the map. #_ Calls {{popupStore.close()}} to dismiss the popup.
#\* Calls {{store.reset()}}.

# On error: sets {{deleting = false}} and throws {{DeleteFeatureError}}.

h3. 4. Cancel

{{PopupComponent.onDeleteConfirm(false)}} calls {{DeleteService.cancelDelete()}}, which calls {{store.reset()}}. The popup remains open showing the feature detail.

---

h2. Click Suppression

{{PopupService.handleClick()}} ignores all map clicks while {{deleteEffects.deleting()}} is {{true}}, preventing a new popup from opening while the confirmation dialog is visible.

---

h2. Error Handling

||Error Class||Base Class||Scenario||
|{{DeleteFeatureError}}|{{RecoverableError}}|{{applyEdits()}} fails or returns an error during feature delete.|
