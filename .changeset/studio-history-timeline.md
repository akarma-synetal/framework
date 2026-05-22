---
'@objectstack/spec': minor
'@objectstack/studio': minor
---

feat(studio): metadata history timeline viewer

Adds a new `history` view mode that surfaces the audit timeline produced by `sys_metadata_history` (ADR-0008 §5) inside Studio. Available for every metadata type as a wildcard built-in plugin.

- `@objectstack/spec`: extend `ViewModeSchema` with `'history'`.
- `@objectstack/studio`: new `historyViewerPlugin` rendering an event timeline (create/update/delete/rename) with op icons, short hash, actor, source, expandable detail panel. ADR-0009 `executionPinned` types (`flow`, `workflow`, `approval`) show a "Pinned" badge explaining that historical versions are retained for in-flight executions.

Reads from the existing `GET /meta/:type/:name/history` REST endpoint via `client.meta.getHistory()`; no new server surface.
