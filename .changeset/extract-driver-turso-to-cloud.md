---
"@objectstack/runtime": major
"@objectstack/cli": major
"@objectstack/spec": major
---

**Breaking:** Removed `@objectstack/driver-turso` and `@objectstack/knowledge-turso` from the open-core framework.

The Turso/libSQL driver and its native-vector knowledge adapter now ship exclusively with the **ObjectStack Cloud** distribution (`objectstack-ai/cloud`). Rationale: Turso is used only for cloud/edge multi-tenant deployments — local development uses better-sqlite3 (faster), and the Turso integration is part of ObjectStack's commercial offering.

### What moved out

- `@objectstack/driver-turso` → `objectstack-ai/cloud/packages/driver-turso`
- `@objectstack/knowledge-turso` → `objectstack-ai/cloud/packages/knowledge-turso`
- `ITursoPlatformService` contract (spec/contracts/turso-platform.ts) — removed entirely
- `TursoConfigSchema`, `TursoDriverSpec`, `TursoMultiTenantConfigSchema`, `TenantResolverStrategySchema`, etc. — moved into `@objectstack/driver-turso` (re-exported from cloud)

### Framework-side changes

- `packages/runtime/src/standalone-stack.ts`: `databaseDriver` enum no longer accepts `'turso'`; `libsql://`/`https://` URL detection removed. Cloud builds register the Turso driver via their own stack composition.
- `packages/runtime/src/cloud/artifact-environment-registry.ts`: dropped `case 'libsql'/'turso'`. Cloud has its own `ArtifactEnvironmentRegistry` that handles Turso.
- `packages/cli/src/commands/serve.ts`: removed `driverType === 'turso' | 'libsql'` branch.
- `packages/runtime/package.json`, `packages/cli/package.json`: removed optional peerDep on `@objectstack/driver-turso`.
- `packages/runtime/tsup.config.ts`: removed `@objectstack/driver-turso` from `external`.
- `packages/spec/src/contracts/index.ts`: stopped re-exporting `turso-platform.js`.
- `packages/spec/src/data/index.ts`: stopped re-exporting `driver/turso-multi-tenant.zod`.

### Migration for open-source users

If you used `libsql://` URLs or `@objectstack/driver-turso` directly, either:
1. Switch to `file:` URLs (better-sqlite3 via `@objectstack/driver-sql`) for local/self-hosted deployments, **or**
2. Use ObjectStack Cloud, which ships the Turso driver as part of the commercial distribution.
