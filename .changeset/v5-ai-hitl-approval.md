---
'@objectstack/service-ai': minor
'@objectstack/spec': patch
---

**Actions-as-tools Phase 3 — Human-In-The-Loop approval queue.**

Dangerous declarative actions (`confirmText`, `mode:'delete'`, `variant:'danger'`) can now be exposed to the LLM safely. Instead of being skipped outright, they are registered as tools whose handler enqueues a pending request and returns `{ status: 'pending_approval', pendingActionId }` to the model. A human approves (or rejects) from Studio's pending-actions inbox; the service then re-runs the exact same dispatcher.

### New surface

- New system object `ai_pending_actions` (id, conversation_id?, message_id?, object_name, action_name, tool_name, tool_input, status [`pending`|`approved`|`executed`|`failed`|`rejected`], result?, error?, rejection_reason?, proposed_by, decided_by?, proposed_at, decided_at?).
- New built-in Studio view `AiPendingActionView` with `pending` / `executed` / `rejected` / `failed` sub-views and per-row **Approve** / **Reject** API actions.
- New methods on `IAIService` (all optional, gated on a wired `IDataEngine`):
  - `proposePendingAction(input) → { id }`
  - `approvePendingAction(id, actorId) → { status, result?, error? }`
  - `rejectPendingAction(id, actorId, reason?)`
  - `listPendingActions(filter?) → PendingActionRow[]`
- New exported types: `PendingActionStatus`, `ProposePendingActionInput`, `PendingActionRow`.
- New REST routes (auth required):
  - `GET    /api/v1/ai/pending-actions`           (`ai:read`)
  - `GET    /api/v1/ai/pending-actions/:id`       (`ai:read`)
  - `POST   /api/v1/ai/pending-actions/:id/approve`  (`ai:approve`)
  - `POST   /api/v1/ai/pending-actions/:id/reject`   (`ai:approve`)
- New exported predicate `actionRequiresApproval(action)` for Studio's exposure surface.

### Wiring

`AIServicePluginOptions` gains `enableActionApproval?: boolean` (default `false`). When `true` and an `IDataEngine` is available, dangerous actions are registered and routed through the queue.

```ts
kernel.use(new AIServicePlugin({
  enableActionApproval: true,           // opt in
  apiActionBaseUrl: 'http://localhost:3000',
}));
```

### Internals

- `actionSkipReason()` accepts `enableActionApproval` + `aiService` in its ctx and stops returning `"requires confirmation"` / `"mode='delete'"` / `"variant='danger'"` when HITL is wired.
- `registerActionsAsTools()` pre-registers a *bypass-approval* dispatcher per dangerous tool via `aiService.registerPendingActionDispatcher(toolName, fn)`; approval calls back into the same code path with `enableActionApproval` flipped off, so a single handler implementation serves both proposal and execution.
- `createActionToolHandler()` short-circuits to `proposePendingAction()` when `enableActionApproval && actionRequiresApproval(action) && ctx.aiService?.proposePendingAction`.

### Out of scope (deferred)

Slack/email notifications, approver routing (any signed-in user can approve in v1), auto-expiry of pending requests, resuming the same LLM turn after approval (operators get a fresh assistant message instead).
