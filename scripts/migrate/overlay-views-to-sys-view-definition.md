# Migration runbook — metadata `view` overlay → `sys_view_definition`

Part of **ADR-0017 (Object has-many View)**, §5.3.

## Who needs this

Only tenants that created **runtime views before `sys_view_definition`
existed**. Those views were written to the metadata customization overlay
(ADR-0005) under `type='view'` via the old adapter path
(`client.meta.saveItem('view', …)`). Phase 4 repointed the runtime
switcher to read `sys_view_definition`, so legacy overlay views stop
appearing until migrated.

Fresh installs and tenants that never used runtime "Add view" need **no
action** — there is nothing to migrate.

> Package views (shipped from `*.view.ts`) are **not** affected: they live
> in the compiled artifact and reach the switcher via `objectDef.listViews`
> (dual-read), never via this overlay.

## Pre-flight

1. Confirm the `sys_view_definition` object is provisioned (ADR-0017 §3.4):
   ```
   GET /api/v1/meta/sys_view_definition        → 200 with object schema
   ```
2. Enumerate legacy overlay views for the tenant:
   ```
   GET /api/v1/meta/view                        → { items: [ … ] }
   ```
   A **runtime** overlay row is one **not** present in the compiled
   artifact — i.e. it has no matching package ViewItem. Package rows must
   be skipped (they are re-shipped from source).

## Field mapping

| overlay `view` field            | `sys_view_definition` column | notes |
|:--------------------------------|:-----------------------------|:------|
| `name`                          | `name`                       | qualified `<object>.<key>` if possible |
| `data.object` / `object`        | `object`                     | required FK |
| (n/a — list-family)             | `view_kind = 'list'`         | `'form'` only for form views |
| `label`                         | `label`                      | |
| `isDefault`                     | `is_default`                 | |
| `sortOrder`                     | `view_order`                 | |
| (overlay is org-wide)           | `scope = 'shared'`           | org-wide overlays migrate as **shared** |
| (none)                          | `owner = NULL`               | shared rows have no owner |
| the whole view spec             | `config`                     | ListView/FormView payload (JSON) |
| `organization_id`               | `organization_id`            | preserve tenant isolation |
| —                               | `state = 'active'`           | |

Rationale for `scope='shared'`: the legacy overlay had no per-user owner,
so every overlay view was effectively org-wide. They migrate to the
`shared` layer; a user can later **duplicate** one into a `personal` copy.

## Migration (per tenant, idempotent)

Run server-side, inside the tenant's `organization_id` context, via the
generic data API so ObjectQL applies validation + org isolation. Pseudocode:

```ts
const overlay = await meta.getItems('view');            // legacy rows
const pkgNames = new Set(
  (await meta.getItems('view'))                          // package ViewItems
    .filter(v => v.viewKind && v.object)                 // expanded items only
    .map(v => v.name),
);

for (const v of overlay) {
  const spec = v.list ?? v;                              // unwrap artifact wrapper
  const object = spec?.data?.object ?? spec?.object;
  const name = spec?.name;
  if (!object || !name) continue;                        // unaddressable — skip
  if (pkgNames.has(name)) continue;                      // package view — skip

  // Idempotency: skip if already migrated (unique on name+org+owner).
  const existing = await data.find('sys_view_definition', {
    filters: ['and', ['name', '=', name], ['object', '=', object], ['state', '=', 'active']],
    top: 1,
  });
  if (existing?.records?.length) continue;

  await data.create('sys_view_definition', {
    name,
    object,
    view_kind: spec?.viewKind === 'form' ? 'form' : 'list',
    label: spec?.label ?? name,
    is_default: !!spec?.isDefault,
    view_order: typeof spec?.sortOrder === 'number' ? spec.sortOrder : 0,
    scope: 'shared',
    owner: null,
    hidden: !!spec?.hidden,
    config: spec,                                         // full ListView/FormView payload
    state: 'active',
  });
}
```

## Post-flight

1. Load each affected object's page; confirm the migrated views appear in
   the switcher under the shared layer.
2. Once verified, the legacy `type='view'` overlay rows may be deleted
   (`DELETE /api/v1/meta/view/:name`). **Leave them in place** during a
   grace period — the runtime tolerates their absence, and keeping them
   lets you re-run the migration if needed.

## Rollback

The migration only **creates** `sys_view_definition` rows; it never
deletes overlay rows. To roll back, delete the created rows
(`state='active'`, `scope='shared'`, matching names) — the legacy overlay
is untouched and the old adapter path can be temporarily restored.
