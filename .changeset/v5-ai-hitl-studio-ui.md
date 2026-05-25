---
'@objectstack/service-ai': minor
---

Polish Studio HITL pending-action inbox UI

The `AiPendingActionView` shipped by `service-ai` is now an actual operator
console rather than a flat grid:

- **Drawer detail panel** — clicking any row opens a side drawer
  (`navigation: { mode: 'drawer', view: 'detail' }`) with four sections:
  Proposal · Tool input · Conversation context · Decision.
- **JSON widget** on `tool_input`, `result`, and `error` so structured tool
  arguments and responses are readable without copy-pasting into a formatter.
- **Relative timestamps** (`type: 'datetime-relative'`) on `proposed_at` /
  `decided_at` columns and form fields.
- **Conversation/message linkbacks** — the existing `Field.lookup` references
  to `ai_conversations` / `ai_messages` are surfaced in a collapsed
  "Conversation context" section, giving operators one-click access from a
  pending action back to the chat that proposed it.
- **Status-conditional fields** via `visibleOn` predicates — `rejection_reason`
  only appears for rejected rows, `error` only for failed rows, etc.
- **Per-row approve/reject buttons** on the Pending tab via `rowActions`
  pointing at the existing `approve_pending_action` / `reject_pending_action`
  object actions; the same actions also render in the drawer header.
- **Status-coloured rows** to make pending vs failed vs executed scannable.

Snapshot-style tests in `__tests__/ai-pending-action.view.test.ts` lock the
shape so future Studio contract changes (widget renames, navigation modes)
fail loudly in one place.

This is a metadata-only change — Studio (`@object-ui/studio`) interprets the
new view automatically. No backend, REST, or HITL semantics changed; the
end-to-end demos in `examples/app-todo/test/ai-hitl*.test.ts` continue to
pass unmodified.
