---
"@objectstack/platform-objects": minor
---

Setup App: added a **Data Model** navigation group with **Objects** and
**Fields** entries that open filtered list views of `sys_metadata`.

To support the new entries, `sys_metadata.listViews` now includes
`only_objects`, `only_fields`, and `all_metadata` — each filtered by
`type` and projecting a curated column set (name, namespace, scope,
managed_by, state, updated_at). The new list views are the read side of
the protocol-driven metadata editing flow; the matching write surface
is provided by `MetadataObjectsPage` / `MetadataFieldsPage` in
`@object-ui/plugin-designer` (separate package), which call the
existing `/api/v1/meta/*` REST endpoints.

No behavioural changes to the metadata REST endpoints themselves; no
migration required.
