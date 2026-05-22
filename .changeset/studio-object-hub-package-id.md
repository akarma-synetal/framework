---
'@objectstack/studio': patch
---

Studio: fix Object Hub Views / Forms / Hooks tabs all showing `(0)`.

The `$package.objects.$name` route was passing the **URL slug** (e.g. `crm`)
as `packageId` to `client.meta.getItems('view', { packageId })`, but the
metadata server filter requires the **full package id** (e.g.
`com.example.crm`). The server-side filter never matched, so the tabs
silently fell back to empty arrays.

Aligned the route with `$package.metadata.$type.$name`: resolve the slug via
`usePackages(packageId)` and pass `selectedPackage.manifest.id` to the API
(falling back to the raw slug until the package list loads).
