---
"@objectstack/studio": patch
---

Live preview for view/page/dashboard/report metadata.

Adds a built-in `objectstack.view-preview` plugin that registers a
`Live Preview` viewer (priority 50, beating the default JSON inspector)
for `view`, `page`, `report`, and `dashboard` types. Opening any of
these from the Views & Apps list now renders a real `@object-ui`
preview (grid / kanban / calendar / form / detail) instead of a JSON
tree. HMR is wired — source edits re-fetch the spec and remount the
preview without a full page reload.
