---
'@objectstack/spec': minor
'@objectstack/rest': minor
'@objectstack/objectql': minor
'@objectstack/platform-objects': minor
---

Metadata Admin engine — protocol foundations.

This is the backend half of the unified Metadata Admin shipped in the Setup
app. The framework now exposes everything the engine needs to render a
directory tile, schema-driven form, layered diff, references graph, and
destructive-change confirmation for every registered metadata type.

- **`GET /api/v1/meta/types`** is now type-rich. Each entry includes
  `{ icon, domain, schema (JSONSchema), allowOrgOverride, allowRuntimeCreate, supportsOverlay, ui? }`
  so the client can render without a second round-trip per type.
- **`GET /api/v1/meta/:type/:name/references`** scans every registered
  metadata type for pointers to the given item (object fields, view sources,
  flow targets, permission objects, …) and returns the inbound edges so the
  UI can warn before deletes.
- **`GET /api/v1/meta/:type/:name?layers=code,overlay,effective`** returns
  each layer separately rather than the merged effective document, powering
  the 3-state diff editor (code source / overlay / effective).
- **Destructive-change detection** on `PUT /api/v1/meta/object/:name` and
  `PUT /api/v1/meta/field/:name`: rejects field type narrowing, required
  toggled on without a default, removed enum values, etc., unless the
  client opts in with `force=true`.
- **Env-var registry patch:** `OBJECTSTACK_METADATA_WRITABLE=object,field,permission,view,…`
  flips `allowOrgOverride` on for the listed types at boot, enabling
  runtime overlays for production without re-deploying spec.
- New guide: **[Adding a Metadata Type](../content/docs/guides/adding-a-metadata-type.mdx)**
  walks through registry entry + Zod schema + optional custom editor.

Setup app navigation now uses the new component-route variant
(`{ type: 'component', componentRef: 'metadata:directory' }`) — the temporary
`/dev/meta` route is removed.
