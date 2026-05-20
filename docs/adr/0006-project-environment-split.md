# ADR-0006: Three-Layer Tenancy — Organization → Project → Environment

**Status**: Accepted
**Date**: 2026-05-20
**Deciders**: ObjectStack Protocol Architects
**Builds on**: ADR-0002 (Environment-Per-Database Isolation), ADR-0003 (Package as First-Class Citizen), ADR-0005 (Metadata Customization Overlay)
**Consumers**: `@objectstack/service-tenant`, `@objectstack/service-cloud`, `@objectstack/spec/cloud`, `apps/cloud`, `apps/objectos`, the Console `cloud_control` app, the Marketplace publisher CLI

---

## Context

After ADR-0002 introduced per-environment databases and ADR-0003 made
`sys_package` a first-class artifact, the runtime ended up with a
**two-layer tenancy** model that conflates two distinct concerns under
`sys_project`:

1. **Authoring** — the human-owned workspace where metadata, customizations,
   branches, reviews, and releases live. There is one of these per
   logical product (e.g. "ACME CRM").
2. **Runtime** — the host that actually serves an environment. There are
   typically three of these per product (`dev`, `staging`, `prod`), each
   with its own DNS hostname, database URL, quota envelope, and rollout
   state.

Today both concerns share `sys_project`:

- `sys_project.databaseUrl` / `databaseDriver` / `storageLimitMb` —
  obviously runtime.
- `sys_project.hostname` — obviously runtime.
- `sys_project.organizationId`, `displayName`, `visibility`,
  `createdBy` — obviously authoring.
- `sys_package_installation.project_id` — pretends one row covers
  both axes, but in practice a CRM customer wants `crm v1.4.2` in `prod`
  and `crm v1.5.0-beta` in `staging`, which the current schema cannot
  express.

This collapses the surface area benchmarks demand:

| Platform | Authoring | Runtime |
|----|----|----|
| Vercel | Project | Environment (Preview, Production, Branch) |
| Salesforce | DX Project | Org (Sandbox, Production, Scratch) |
| ServiceNow | Application | Instance (dev/test/prod) |
| Kubernetes | Application (chart/release) | Cluster + Namespace |
| Linear | Workspace | n/a (single environment) |
| **ObjectStack today** | sys_project | sys_project ← *same row* |

Every shipped platform separates the two. The conflation is the root
cause of three open issues currently surfaced in the Cloud Console:

- **#proj-env-1** Per-row "promote dev → prod" requires invasive
  column-rewriting because there is no `Environment` to copy *to*.
- **#proj-env-2** Database limit / driver are forced on every project
  even when the user has not yet provisioned a runtime
  (the `min=max=0` storage-limit field in the Create Project form is
  a direct symptom).
- **#proj-env-3** The Marketplace / template story has no answer to
  *"install this package into staging only"* — installations are
  pinned to projects, not environments.

---

## Decision

Adopt a **three-layer tenancy** model. Make each layer a first-class
control-plane object with explicit FKs.

```
Organization (cloud-tenant — billing, members, SSO config)
  └── Project (authoring repo — metadata + branches + revisions + RBAC)
        └── Environment (runtime container — hostname + DB + quota + status)
              └── Installation (package version pinned in this env)
```

Mapping to existing surfaces:

| Layer | Schema | Lifecycle | Examples |
|----|----|----|----|
| **Organization** | `sys_organization` | Created at signup, persists forever | "ACME Inc." |
| **Project** | `sys_project` (slimmed) | Created by a user, owns metadata | "ACME CRM" |
| **Environment** | `sys_environment` (NEW) | Created per project, 1..N per project | `acme-crm-prod`, `acme-crm-staging` |
| **Installation** | `sys_package_installation` (FK migrated) | Created by install, pinned to env+version | `crm@1.4.2` installed in `acme-crm-prod` |

### Field migration

Move out of `sys_project` and into `sys_environment`:

- `databaseUrl`, `databaseDriver`, `storageLimitMb` (and the underlying
  Turso/Postgres connection metadata)
- `hostname` (per-env DNS)
- `status` (active / suspended / failed / archived — distinct from the
  authoring lifecycle of the project itself)
- `provisionedAt`

Keep on `sys_project`:

- `id`, `organizationId`, `displayName`, `slug`, `visibility`,
  `description`, `iconUrl`, `createdBy`, `createdAt`, `updatedAt`

Add to `sys_project`:

- `defaultEnvironmentId` — UI default for "Open project" actions.
- `branchingModel` — `'trunk' | 'env-mirrored'` (Phase 2).

`sys_package_installation`:

- FK migrates `project_id → environment_id` (one installation row per
  package per environment, allowing per-env version pinning).

### Backward compatibility (Phase 1)

For one major version, keep `sys_project.databaseUrl/...` as
**deprecated mirror columns** populated by a database trigger from
the project's default environment. All write paths must update
`sys_environment` and the trigger fans out. Read paths continue to
work unchanged. After the migration window, the columns are dropped.

### Console UX impact

The migrated `cloud_control` app gets two new surfaces:

- `sys_environment` list/detail (already partially scaffolded;
  see `packages/services/service-tenant/src/objects/sys-environment.object.ts`).
- A 3-step `create_project` wizard:
  1. **Choose blueprint** — pick a `sys_package` row where
     `is_starter = true` (this unifies "templates" with the
     Marketplace; see ADR-0003 §"Starter packages" addendum).
  2. **Configure project** — display name, slug, visibility,
     organization (auto-filled from the active org).
  3. **Configure first environment** — name (`prod` default),
     driver, plan, storage limit. Subsequent environments are
     created from the environment list view.

The old single-step form remains accepted by `POST /api/v1/cloud/projects`
for one release; new fields default conservatively (single `prod`
environment auto-created).

---

## Consequences

### Positive

1. **Vercel-grade promotion story.** "Promote `staging` to `prod`" is
   `INSERT INTO sys_package_installation (env_id, package_version_id)
   SELECT 'prod-env', package_version_id FROM sys_package_installation
   WHERE env_id = 'staging-env'`.
2. **Per-env version pinning** unblocks the Marketplace install model
   the user requested ("templates as packages"). The `templateId` URL
   parameter on Create Project becomes a `package_version_id` selected
   from `sys_package WHERE is_starter = true`.
3. **Clean form UX.** Create Project no longer forces driver / storage
   limit decisions before the user even understands what a "project"
   is — those are environment concerns, made after the project exists.
4. **Quota composition.** Org quota = Σ project quota = Σ environment
   quota. Today the schema cannot express this because there is no
   project ↔ env relation.
5. **RBAC layering.** Project-level "viewer / editor / admin" maps to
   metadata authoring; environment-level "deploy / suspend / read-logs"
   maps to runtime ops. They are not the same permission set.

### Negative / Costs

1. **Schema migration.** `sys_package_installation.project_id →
   environment_id`. Done by a one-shot migration that creates a default
   `prod` environment per existing project and rewrites the FK. Mirror
   columns on `sys_project` make this online.
2. **API surface grows.** `/api/v1/cloud/environments/*` is added;
   `/api/v1/cloud/projects/*` slims. SDK type contracts shift.
3. **Documentation churn.** Every page that says "project database"
   has to say "environment database". One-time tax.

### Neutral

1. Existing `sys_project` rows continue to work — they have an
   implicit single `prod` environment after Phase 1 migration.
2. `apps/cloud` worker routing (`*.{ROOT_DOMAIN}` → DO) becomes
   `hostname → environment → project` instead of `hostname → project`.
   Same mechanism, more accurate naming.

---

## Phasing

| Phase | Scope | Status |
|----|----|----|
| **0 — Foundation** | This ADR; `is_starter` + `publisher` on `sys_package`; session auth on `/api/v1/cloud/*` (so the Console can drive the rest) | **Done** (this PR) |
| **1 — Schema split** | `sys_environment` table; mirror columns on `sys_project`; `sys_package_installation.environment_id` migration; default-env auto-create | Next |
| **2 — Console wizard** | 3-step Create Project; environment list/detail; per-env install picker; remove deprecated mirror columns | Following |
| **3 — Promotion / Deployment** | `sys_deployment` (Environment × ProjectRevision tuple); promote-between-envs UI; quota composition rollup | Later |

Each phase is independently shippable behind a feature flag
(`cloud.threeLayer=true` resolved per-org).

---

## Open questions (deferred to Phase 1)

- **Branching model**: are branches a property of the project (single
  trunk + named branches, Linear-style) or of the environment
  (one branch == one environment, Vercel Preview-style)? Plan §12 of
  the prior session leaned trunk-with-branches; revisit when wiring
  the revision-history UI.
- **Default environment policy on signup**: do new projects auto-create
  `prod`, or `dev`, or both? Recommend `prod` only — most users prove
  the idea in one environment first.
- **Per-environment cost limits**: should quotas be set at project level
  and divided, or set per-environment? Recommend per-environment with
  optional project-level cap.

---

## References

- ADR-0002 — Environment-Per-Database Isolation (set the per-env DB
  invariant this ADR makes structurally explicit).
- ADR-0003 — Package as First-Class Citizen (this ADR removes the
  remaining "template" concept by promoting starter packages).
- ADR-0005 — Metadata Customization Overlay (overlays live at the
  project layer; environments inherit overlays from their project).
- `/Users/zhuangjianguo/.copilot/session-state/8445ca18-486f-41e8-aa08-f6869d28aecb/plan.md`
  §12.3 — original three-layer-model recommendation that this ADR
  formalizes.
- `packages/services/service-tenant/src/objects/sys-project.object.ts`
  — current conflated schema.
- `packages/services/service-tenant/src/objects/sys-environment.object.ts`
  — Phase 1 starting point (already partially scaffolded).
