# ADR-0016: Studio Package Authoring & One-Click Publish

**Status**: Proposed (2026-05-29)
**Deciders**: ObjectStack Protocol Architects
**Builds on**: [ADR-0003](./0003-package-as-first-class-citizen.md) (package + versioned releases), [ADR-0005](./0005-metadata-customization-overlay.md) (one Zod source per type, org overlay), [ADR-0006 v4](./0006-project-environment-split.v4.md) (drop project, unify on package), [ADR-0008](./0008-metadata-repository-and-change-log.md) (Repository/ChangeLog/Cache/Registry, four write surfaces), [ADR-0010](./0010-metadata-protection-model.md) (L1/L2/L3 protection)
**Consumers**: `@objectstack/spec/cloud`, `@objectstack/runtime`, `@objectstack/metadata`, `@objectstack/rest`, `@objectstack/cli`, `../objectui` (Studio)

---

## 0. Context

Studio is a metadata-driven admin app that already lets a user browse and
edit metadata visually. Two recent changes set the stage for a cloud
authoring loop:

- A sidebar **package scope** selector (`active_package`) was added; it now
  lists only third-party (non-kernel) packages, with a "no package" option.
- Recently-viewed tracking was fixed for metadata routes.

But the **authoring → publish closed loop is not yet implemented**. Today:

1. Studio create/edit (`ResourceEditPage.tsx:733`) calls
   `client.save(type, name, item, { force, mode:'draft' })` with **no
   `packageId`**. Per ADR-0003 this produces a **runtime/overlay** row
   (`env_id` set, `package_id` NULL, loaded under sentinel `'sys_metadata'`,
   `provenance='runtime'`). It is env-local — it never becomes part of a
   shippable package.
2. There are **two publish paths** (per ADR-0006 v4):
   - `os publish -e <env>` → `POST /cloud/environments/:id/metadata` →
     env **revision** (legacy).
   - `os package publish` → `POST /cloud/packages` → `POST
     /cloud/packages/:id/versions` → install (strategic, Phase B).
   Neither is reachable from Studio. The user must drop to the CLI and author
   metadata in local files, not in the visual editor.

The user's goal: **inside Studio, select (or create) a package, visually
author metadata that is bound to that package, preview it, then one-click
publish it to the cloud** — without leaving the browser and without writing
local files.

## 1. Goals & Non-goals

### Goals

- A first-class **cloud authoring workspace** for a package that lives in the
  control plane (not in env-local overlay rows).
- Studio binds created/edited metadata to the selected package's authoring
  workspace instead of producing an env-local overlay.
- A **preview** mechanism so authors see their in-progress package running in
  a real environment before publishing.
- A **one-click publish** action that seals the workspace into an immutable
  `sys_package_version` and installs it into a chosen environment.
- **CLI parity**: `os package publish` and the Studio button hit the same
  control-plane endpoints (ADR-0006 v4 Phase B).
- Reuse existing schema as much as possible — minimal new protocol surface.

### Non-goals

- Marketplace listing / monetization (separate `service-marketplace`).
- Multi-author concurrent editing / locking semantics beyond ADR-0010.
- Replacing the local-files + `os publish` flow for power users; both
  coexist (ADR-0006 v4 "two flows, one schema").
- Git-style branching of package versions (single active draft per package
  per org for v1).

## 2. Decision

Introduce a **draft package version as the cloud authoring workspace**, and
make the Studio `active_package` selector the **authoring target**.

1. **Draft `sys_package_version` = authoring workspace.** A package may have
   at most **one active `draft` version per org** (ADR-0003 already defines
   `status ∈ {draft, published, deprecated}`). The draft is mutable; metadata
   rows bound to it carry `package_version_id = <draft.id>`.

2. **Selector designates the authoring target.** When a package is selected in
   the sidebar, Studio create/edit binds the row to that package's draft
   version (`package_version_id`). When **"no package"** is selected, the
   existing behavior holds: a NULL-package **env-local overlay**
   (`provenance='runtime'`). This makes the user's earlier question — *"is
   creating without a package allowed?"* — an explicit, intentional choice:
   no-package = personal/env customization; package = shippable artifact.

3. **Preview via draft install.** A dev/sandbox environment installs the draft
   version (`allowDraft`, per ADR-0003) so authors see their package running
   live. Preview installs are flagged and never auto-promoted to production.

4. **One-click publish.** The publish action:
   1. **Seals** the draft → `published` (freeze `manifest_json`, compute
      checksum, assign immutable semver).
   2. **Upserts** `sys_package_installation` into the chosen target
      environment (pointer swap to the new `package_version_id`).
   3. Opens a fresh `draft` for continued authoring (next version).
   This reuses ADR-0006 v4 Phase B endpoints — no new publish pipeline.

5. **One schema, two write surfaces (ADR-0008).** Package-bound edits and
   env-local overlays are the same `sys_metadata` shape, discriminated by
   `package_version_id`. The ChangeLog records both; the Registry resolves
   precedence (published < draft-preview < env overlay, see §3.4).

## 3. Detailed design

### 3.1 Schema reuse (no new tables)

Everything needed already exists from ADR-0003:

| Concern | Existing artifact | Use in this ADR |
|---|---|---|
| Authoring workspace | `sys_package_version` `status='draft'` | The mutable draft per package/org |
| Binding | `sys_metadata.package_version_id` | Set to draft id on package-bound edits |
| Env-local overlay | `sys_metadata` with NULL package | Unchanged "no package" path |
| Install/preview | `sys_package_installation` (+ `allowDraft`) | Preview + publish target |
| Sealing | `sys_package_version.manifest_json` + checksum | Frozen on publish |

New protocol surface is limited to **a draft-resolution helper** and an
optional `is_preview` flag on installation (see §3.5). No new top-level
metadata type is introduced.

### 3.2 Authoring-target resolution

Studio needs the **draft version id** for the selected package. Resolution
order when the user selects package `P` in org `O`:

1. If `P` has an active `draft` version for `O` → use it.
2. Else **lazily create** a draft (`status='draft'`, base = latest
   `published` version's manifest, or empty if first version) and use it.

The draft id is held in Studio app context (alongside `active_package`) and
attached to every save while that package is the authoring target.

### 3.3 Studio save flow change

`ResourceEditPage` save changes from:

```ts
client.save(type, name, item, { force, mode: 'draft' });
```

to (when a package is the authoring target):

```ts
client.save(type, name, item, {
  force,
  mode: 'draft',
  packageVersionId: activeDraftVersionId, // binds to the package draft
});
```

When "no package" is selected, `packageVersionId` is omitted → unchanged
env-local overlay. The REST `save` handler routes the row to
`package_version_id` instead of `env_id`.

### 3.4 Resolution precedence (Registry)

For a given `MetaRef = {org, type, name}` the Registry (ADR-0008) resolves in
order of increasing specificity:

1. **Platform-global** (both `env_id` and `package_id` NULL).
2. **Published package version** installed in the env (`package_version_id`,
   immutable, locked per ADR-0010).
3. **Draft-preview** (the draft version installed for preview in this env) —
   shadows the published row so authors see work-in-progress.
4. **Env-local overlay** (`env_id` set, NULL package) — highest precedence,
   personal customization, unchanged.

Draft-preview rows are only visible in environments that explicitly installed
the draft (`allowDraft` + `is_preview`); production envs never see drafts.

### 3.5 API surface

Reuse ADR-0006 v4 Phase B endpoints; add only what is missing:

| Action | Endpoint | Notes |
|---|---|---|
| Resolve/ensure draft | `POST /cloud/packages/:id/draft` | Idempotent; returns active draft version (lazily creates per §3.2) |
| Bind metadata to draft | `POST /api/v1/metadata/:type/:name` (existing save) | Now accepts `packageVersionId` |
| Preview install | `POST /cloud/environments/:envId/installations` | `{ packageVersionId, isPreview: true }` (allowDraft) |
| Publish (seal) | `POST /cloud/packages/:id/versions` | Seals draft → published; freezes manifest + checksum |
| Install to target | `POST /cloud/environments/:envId/installations` | `{ packageVersionId }` pointer swap |

`isPreview` is the one **new field** on `sys_package_installation`
(boolean, default false) — distinguishes preview installs from production so
they can be listed/garbage-collected separately.

### 3.6 Studio UX flow

1. **Select / create package.** Sidebar `active_package` selector gains a
   "+ New package" item → small wizard (id `com.acme.foo`, name, version
   `0.1.0`). Creating sets it as authoring target and ensures a draft (§3.2).
2. **Author.** Create/edit objects, views, flows, etc. Each save binds to the
   draft (§3.3). Provenance badge shows **Draft (package)** vs **Runtime
   (env-local)** vs **Published (locked)** (ADR-0010 lock state drives
   editability).
3. **Preview.** "Preview" button installs the draft into the author's
   sandbox env (`isPreview`) and opens the running app.
4. **Review / diff.** Show the ChangeLog (ADR-0008) for the draft: what was
   added/changed vs the last published version.
5. **Publish.** "Publish" button → pick target environment → seal draft →
   install. Success toast links to the running app and the new version.

### 3.7 CLI parity

`os package publish` performs the same three control-plane calls (seal →
version → install). The Studio button and the CLI are interchangeable; both
go through `POST /cloud/packages/:id/versions`. Local-files authors keep
using `os publish` / `os package publish`; Studio authors never touch files.

### 3.8 Protection interplay (ADR-0010)

- **Draft** rows: editable/deletable (L3 `_lock` absent).
- On **publish**, the sealed version's rows inherit the package
  `metadataDefaults.lock` (L2) → installed published rows are **read-only** in
  consuming envs; customization happens via env-local overlay (path 4 in
  §3.4), exactly as today.
- Platform/kernel packages (`scope ∈ {system, cloud}`) remain excluded from
  the authoring selector — you cannot author into a kernel package.

## 4. Phasing

This realizes "Phase 5 Builder UX" of ADR-0006 v4 inside Studio, layered on
the already-shipped Phase B package endpoints.

- **Phase 1 — Binding.** REST `save` accepts `packageVersionId`; metadata
  router writes `package_version_id`. `POST /cloud/packages/:id/draft`
  (resolve/ensure draft). Studio attaches the active draft id to saves.
- **Phase 2 — Provenance UX.** Provenance badges (draft / published / runtime)
  in `ResourceListPage` + `ResourceEditPage`; "+ New package" wizard in the
  sidebar selector.
- **Phase 3 — Preview.** `isPreview` installation field; "Preview" button +
  sandbox install + open-app.
- **Phase 4 — Publish.** "Publish" button → env picker → seal + install;
  ChangeLog diff view; auto-open next draft.
- **Phase 5 — Polish.** GC of stale preview installs; multi-version history
  browsing; CLI/Studio parity tests.

## 5. Consequences

### Positive

- Closes the visual authoring → publish loop entirely in the browser.
- No new metadata type; reuses ADR-0003 draft versions and ADR-0006 v4
  endpoints. One `sys_metadata` shape, one publish pipeline.
- Makes "no package" an explicit, meaningful choice (env-local customization)
  rather than an accidental default.
- Studio and CLI converge on the same control-plane contract.

### Negative

- Introduces a stateful "authoring target" (active draft) in Studio context
  that must be kept consistent with the sidebar selector.
- Preview installs add lifecycle/GC burden (mitigated by `isPreview` flag).
- Draft-preview resolution adds a precedence layer to the Registry (§3.4).

### Neutral

- Local-files + `os publish` flow is unaffected; both surfaces coexist.
- Lock semantics are unchanged — published artifacts stay read-only, overlay
  customization path is preserved.

## 6. Alternatives considered

1. **Author directly as env-local overlays, then "promote" to a package.**
   Rejected: promotion would have to reverse-engineer package membership from
   loose overlay rows, re-introducing the ADR-0003 problem of packages with no
   identity. Binding at author time is cleaner.
2. **A dedicated new "authoring session" table.** Rejected: `sys_package_version`
   with `status='draft'` already is the mutable workspace; a parallel table
   would duplicate ADR-0003 and fork the publish pipeline.
3. **Git-backed package source in the browser.** Rejected for v1: heavyweight;
   the control-plane draft already provides atomic seal/version semantics.
4. **Multiple concurrent drafts per package.** Deferred: single active draft
   per package/org keeps resolution unambiguous; branching can come later.

## 7. Open questions

- **Draft conflict / multi-author.** If two admins edit the same package
  draft, do we need optimistic locking on `sys_package_version` rows beyond
  ADR-0010 L3? (Lean: row-level `_version` check; defer real collaboration.)
- **Preview env provisioning.** Does each author get an auto-provisioned
  sandbox env, or reuse their current env with preview installs? (Lean:
  reuse current env + `isPreview`, with a visible banner.)
- **Versioning UX.** Auto-bump semver on publish, or prompt? (Lean: prompt with
  suggested patch bump.)
- **Cross-package references.** If draft package A references metadata owned by
  published package B, how is the dependency recorded in `manifest_json`?
  (Likely an extension of ADR-0003 dependency edges — out of scope here.)

## 8. References

- [ADR-0003](./0003-package-as-first-class-citizen.md) — Package + versioned releases
- [ADR-0005](./0005-metadata-customization-overlay.md) — One Zod source, org overlay
- [ADR-0006 v4](./0006-project-environment-split.v4.md) — Drop project, unify on package; Phase B publish
- [ADR-0008](./0008-metadata-repository-and-change-log.md) — Repository/ChangeLog/Cache/Registry
- [ADR-0010](./0010-metadata-protection-model.md) — L1/L2/L3 protection
- `packages/cli/src/commands/package/publish.ts` — CLI publish (seal → version → install)
- `../objectui/.../metadata-admin/ResourceEditPage.tsx` — Studio save flow (binding point)
- `../objectui/.../layout/UnifiedSidebar.tsx` — `active_package` selector (authoring target)
