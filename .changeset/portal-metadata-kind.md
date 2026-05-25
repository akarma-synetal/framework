---
'@objectstack/spec': minor
---

Add `Portal` metadata kind for external-user UI projections.

A `Portal` declares a public-facing "site" derived from an existing `App` (or a curated subset of objects/views), with its own theme, authentication mode (anonymous / passwordless / sso), custom routes, and per-route guards. This is the protocol surface for the "customer portal" use case — partner sites, public booking, support knowledge bases — without forking the back-office `App`.

**New exports under `@objectstack/spec/ui`:**

- `PortalSchema`, `Portal` — Zod schema + inferred type.
- `PortalRouteSchema`, `PortalRoute` — per-route configuration (view ref, layout, auth requirement, sharing scope).
- `PortalAuthModeSchema` — enum of auth strategies (`anonymous`, `passwordless`, `oauth`, `sso`).
- `definePortal()` — DX builder mirroring `defineApp()`.

**Stack composition:** `composeStacks()` now accepts and merges `portals` alongside `apps`, `objects`, `views`, etc.

No runtime / app behaviour change — this ships the protocol contract first so plugins, Studio, and the runtime can land Portal support in subsequent releases.
