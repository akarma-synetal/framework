---
'@objectstack/cli': patch
'@objectstack/runtime': patch
---

Remove residual coupling to the (already-extracted) `@objectstack/service-cloud` package.

The cloud distribution was migrated to a separate repo a while back, but the open-core CLI still carried:

- A dynamic `import('@objectstack/service-cloud')` in the boot-mode dispatch for `cloud` / `runtime` modes.
- A dev-mode auto-mount that tried to load `createSingleEnvironmentPlugin` from the cloud package (now fully covered by the built-in `RuntimeConfigPlugin`).
- An ambient `.d.ts` stub for `@objectstack/service-cloud`.
- A leftover empty `packages/services/service-cloud/` directory (only stale `dist/` + `node_modules/`).
- Several doc-comment references.

All gone. The open-core CLI now supports `bootMode: 'standalone'` only — non-standalone modes throw a clear error pointing users to the cloud distribution. No runtime behavior change for standalone users.
