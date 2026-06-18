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

- **`usr_system` is never minted (runtime + objectql).** The seed loader binds
  `os.user` to a NULL identity, so `cel`os.user.id`` resolves to NULL at seed
  time (the owning admin does not exist yet) and the row seeds NULL-owned — then
  the handoff above fills it. The runtime's `ensureSeedIdentity` (the only code
  that inserted a `usr_system` row) is removed. `SystemUserId.SYSTEM` survives
  only as a reserved id so legacy DBs' exclusion guards / ownership handoff still
  recognize a pre-existing row. `os.org` is unaffected (derived from
  `organizationId`).

Also hardens `bootstrapPlatformAdmin` against a latent dts typecheck error
(defensive read of the untyped `description` on seed permission sets).
