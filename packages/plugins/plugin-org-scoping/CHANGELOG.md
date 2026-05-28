# @objectstack/plugin-org-scoping

## 6.9.0

### Initial release

Extracted from `@objectstack/plugin-security` (which previously gated the same logic behind a `multiTenant: true` constructor option). The split lets single-tenant deployments install plugin-security without paying for organization-scoping middleware, and lets organization-scoping be reasoned about as a self-contained protocol with its own tests.

#### Surface

- `OrgScopingPlugin` — main plugin class.
- `claimOrphanOrgRows(ql, organizationId)` — adopt NULL-org seed rows into the first organization.
- `cloneOrgSeedData(ql, organizationId)` — clone the donor org's seed rows into a freshly-created org.
- `ensureDefaultOrganization(ql)` — bind the first platform admin to a `Default Organization` (slug `default`).

#### Behavior

When registered, the plugin installs three ObjectQL middlewares:
1. Insert auto-stamp of `organization_id` from `ExecutionContext.tenantId`.
2. Post-insert pipeline on `sys_organization`: seed-replay → claim → clone.
3. Default-org bootstrap on `kernel:ready` and after every `sys_user_permission_set` insert.

It also exposes itself as the `org-scoping` service so `@objectstack/plugin-security` can detect its presence and keep wildcard `current_user.organization_id` RLS policies.
