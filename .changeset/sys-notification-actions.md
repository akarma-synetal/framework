---
'@objectstack/platform-objects': patch
---

Add `mark_read` / `mark_unread` row actions to `sys_notification` and polish
listView columns + grouping.

- Row-level `mark_read` / `mark_unread` actions guarded by CEL `visible`
  expressions so each only renders on rows in the appropriate state. Both
  use the generic PATCH `/api/v1/data/sys_notification/{id}` endpoint with
  `bodyExtra` to flip `is_read` (and clear `read_at` on unmark).
- Reordered listView columns to lead with `title` + `actor_name` (the "who
  did what" users actually scan) and demote `type` to a chip column.
- `mine` view now groups by `type` so mention/assignment storms don't bury
  system or task_due rows.

`mark_all_read` is intentionally not added server-side — there's no bulk
PATCH primitive on the REST surface yet, and the popover already handles
multi-row mark-all client-side via N single-row PATCHes
(`InboxPopover.tsx` → `AppHeader.markAllRead`).
