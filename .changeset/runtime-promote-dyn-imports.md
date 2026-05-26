---
"@objectstack/runtime": patch
"@objectstack/cli": patch
---

Fix `npx @objectstack/cli start` crashing with `Cannot find package
'@objectstack/metadata'` (and friends).

`@objectstack/runtime` dynamically `import()`s `@objectstack/metadata`,
`@objectstack/objectql`, and the storage drivers (`driver-memory`,
`driver-sql`, `driver-sqlite-wasm`, `driver-turso`) from
`createStandaloneStack` / `createDefaultHostConfig`, but they were only
listed in `devDependencies` — so when the package was installed from npm
(rather than the workspace) these imports failed at boot.

They are now declared as real `dependencies`. `@objectstack/driver-mongodb`
remains an `optionalDependency` because the standalone stack only loads
it when the user passes a `mongodb://` URL (the failure path already has
a friendly error message).

Also adds a small quick-start CLI command (`objectstack start`) that
auto-creates `~/.objectstack/{data,dist,auth-secret}`, boots an empty
kernel with Studio + marketplace mounted, and lets users install apps at
runtime — no `objectstack.config.ts` required.
