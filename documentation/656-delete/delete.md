# Feature Delete

**Task:** 656  
**Branch:** feature/656-delete  
**Date:** July 2026

---

## Overview

The Delete system allows users to permanently remove a feature from its `FeatureLayer`. It is triggered from the **popup header** via a trash icon and is intentionally minimal: a confirmation dialog is shown inline within the popup before any destructive action is taken.

There is no standalone form component — the entire delete interaction lives inside `PopupComponent` and is orchestrated by `DeleteService` and `DeleteStore`.

Delete capability is checked at runtime via `isLayerDeletable(graphic)` in `layer/layer-capabilities.ts`, which requires `layer.editingEnabled` and `capabilities.operations.supportsDelete`.

---

## Architecture

| Unit                          | Role                                                                                                                  |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `DeleteStore`                 | NgRx SignalStore — holds the pending `graphic`, a `deleting` in-flight flag, and a `confirmRequested` flag.           |
| `DeleteService`               | `requestDelete()`, `confirmDelete()` (`applyEdits({ deleteFeatures })`), `cancelDelete()`.                            |
| `DeleteEffects`               | Root effect service — exposes the `deleting` computed signal used for click suppression.                              |
| `delete-errors.ts`            | `DeleteFeatureError` (recoverable).                                                                                   |
| `PopupComponent`              | Renders the trash icon button and the inline `<rima-confirm-dialog>` when `deleteStore.confirmRequested()` is `true`. |
| `layer/layer-capabilities.ts` | `isLayerDeletable(graphic)` — checks `editingEnabled` and `supportsDelete`.                                           |

---

## State (`DeleteStore`)

```
DeleteState {
  graphic: Graphic | null
  deleting: boolean          // true while applyEdits is in-flight
  confirmRequested: boolean  // true while waiting for user confirmation
}
```

**Computed signal:**

| Signal   | Derivation        |
| -------- | ----------------- |
| `active` | `graphic != null` |

**Methods:**

| Method                   | Behaviour                                                      |
| ------------------------ | -------------------------------------------------------------- |
| `requestDelete(graphic)` | Stores the pending graphic and sets `confirmRequested = true`. |
| `setDeleting(boolean)`   | Toggles the in-flight flag.                                    |
| `reset()`                | Returns all state to initial values.                           |

---

## Flow

### 1. Capability check

The popup header shows a trash icon only when `isLayerDeletable(graphic)` returns `true`:

- `layer` is a `FeatureLayer`.
- `layer.editingEnabled === true`.
- `layer.capabilities.operations.supportsDelete === true`.

### 2. Request

Clicking the trash icon calls `PopupComponent.startDelete()`, which calls `DeleteService.requestDelete(graphic)`:

- Stores the graphic in `DeleteStore`.
- Sets `confirmRequested = true`.

The popup immediately renders an inline `<rima-confirm-dialog>`:

> **"Are you sure you want to delete this feature? This action cannot be undone."**
>
> Actions: **Delete** | **Cancel**

### 3. Confirm

`PopupComponent.onDeleteConfirm(true)` calls `DeleteService.confirmDelete()`:

1. Sets `deleting = true`.
2. Resolves the `objectIdField` from the layer.
3. Calls `layer.applyEdits({ deleteFeatures: [{ [objectIdField]: objectId }] })`.
4. On success:
   - Calls `layer.refresh()` to update the map.
   - Calls `popupStore.close()` to dismiss the popup.
   - Calls `store.reset()`.
5. On error: sets `deleting = false` and throws `DeleteFeatureError`.

### 4. Cancel

`PopupComponent.onDeleteConfirm(false)` calls `DeleteService.cancelDelete()`, which calls `store.reset()`. The popup remains open showing the feature detail.

---

## Click Suppression

`PopupService.handleClick()` ignores all map clicks while `deleteEffects.deleting()` is `true`, preventing a new popup from opening while the confirmation dialog is visible.

---

## Error Handling

| Error Class          | Base Class         | Scenario                                                        |
| -------------------- | ------------------ | --------------------------------------------------------------- |
| `DeleteFeatureError` | `RecoverableError` | `applyEdits()` fails or returns an error during feature delete. |
