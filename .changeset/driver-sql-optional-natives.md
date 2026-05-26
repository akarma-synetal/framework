---
'@objectstack/driver-sql': patch
---

Promote native database client packages so npm consumers can boot without manual installs.

- `better-sqlite3` is now an `optionalDependency` (prebuilt binaries cover the common case), so `npx @objectstack/cli start` boots a default SQLite database out-of-the-box.
- `pg`, `mysql2`, `sqlite3`, and `tedious` are declared as optional `peerDependencies` (`peerDependenciesMeta.optional = true`), removing install warnings while keeping the loader-on-demand pattern.

Fixes: `Knex: Cannot find module 'better-sqlite3'` on fresh `npm install @objectstack/cli` followed by `objectstack start`.
