---
"@objectstack/objectql": minor
"@objectstack/plugin-security": minor
"@objectstack/runtime": minor
---

feat(ownership): auto-provision a canonical `owner_id` and hand seeded records to the first admin

Ownership is now correct-by-default instead of opt-in — closing the gap where
seeded demo data ended up owned by nobody a human can log in as (so "My" views,
owner reports and owner notifications were empty out of the box) and where
author-written objects silently shipped with no working ownership at all.

- **`applySystemFields` (objectql)** now auto-injects a canonical, reassignable
  `owner_id` lookup (→ `sys_user`) on user-authored business objects, alongside
  the existing tenant/audit fields. Unlike the audit `*_by` lookups it is NOT
  readonly — ownership transfers. Withheld for `managedBy` / `sys_*` tables and
  for objects that opt out via `ownership: 'org' | 'none'` (Dataverse-style). The
  safe default direction: forgetting the opt-out leaves a harmless spare column,
  whereas the old opt-IN model let authors ship objects with broken ownership.
  Once present, the existing machinery engages automatically (insert auto-stamp,
  owner-scoped RLS, owner-keyed views/reports).

- **`claimSeedOwnership` (plugin-security)**, invoked from `bootstrapPlatformAdmin`
  right after the first human is promoted to platform admin, transfers ownership
  of seeded rows (`owner_id` NULL or `usr_system`) to that admin. The ownership
  twin of org-scoping's `claimOrphanOrgRows`. Idempotent; skips `managedBy` /
  `sys_*`. Authors write plain seed records (no `owner_id`) and the platform —
  not the author — performs the handoff, so there is nothing to remember or
  mistype.

- **`usr_system` is now provisioned lazily (runtime)** — only when a seed
  dataset actually embeds `cel`os.user.id``. Because the default model leaves
  `owner_id` NULL and relies on the handoff above, a typical bundle never
  references `os.user`, so the non-loginable `usr_system` placeholder is never
  created. It survives purely as a backward-compatible fallback; `os.org` is
  unaffected (derived from `organizationId` in the loader).

Also hardens `bootstrapPlatformAdmin` against a latent dts typecheck error
(defensive read of the untyped `description` on seed permission sets).
