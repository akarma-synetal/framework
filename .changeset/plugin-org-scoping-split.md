---
'@objectstack/plugin-security': major
'@objectstack/plugin-org-scoping': minor
'@objectstack/runtime': patch
'@objectstack/plugin-dev': patch
'@objectstack/cli': patch
---

**Split organization-scoping from `@objectstack/plugin-security` into a new `@objectstack/plugin-org-scoping` package.**

Per ADR-0002, "tenant" in ObjectStack means *physical* isolation (one Environment = one database, handled by `@objectstack/driver-turso`'s multi-tenant router). The row-level `organization_id` scoping that previously lived inside SecurityPlugin is a different concept — *logical* scoping inside a single DB — and now ships as its own plugin.

### Breaking changes — `@objectstack/plugin-security`

- Removed the `multiTenant` constructor option. SecurityPlugin no longer touches `organization_id` on insert and no longer registers the `sys_organization` post-create seed pipeline.
- Wildcard `current_user.organization_id` RLS policies in the default permission sets are now stripped UNLESS the new `org-scoping` service is registered (i.e. unless `OrgScopingPlugin` is also installed).
- Removed export `cloneTenantSeedData` (now exposed as `cloneOrgSeedData` from `@objectstack/plugin-org-scoping`).
- `bootstrapPlatformAdmin()` no longer accepts a `multiTenant` flag and no longer auto-creates a default organization — that behavior moved to `ensureDefaultOrganization()` in the new plugin.

### Migration

Single-tenant deployments — no action required.

Multi-tenant deployments (previously `new SecurityPlugin({ multiTenant: true })`):

```diff
+ import { OrgScopingPlugin } from '@objectstack/plugin-org-scoping';
  import { SecurityPlugin } from '@objectstack/plugin-security';

+ await kernel.use(new OrgScopingPlugin());     // MUST be BEFORE SecurityPlugin
- await kernel.use(new SecurityPlugin({ multiTenant: true }));
+ await kernel.use(new SecurityPlugin());
```

The runtime's `OS_MULTI_TENANT` env switch — read by `@objectstack/runtime/cloud/ArtifactKernelFactory`, `@objectstack/plugin-dev`, and the `objectstack` CLI's `serve` / `dev` / `start` commands — automatically registers `OrgScopingPlugin` when set to `true`, so projects driven by the CLI need no code changes.
