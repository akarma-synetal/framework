---
"@objectstack/metadata": minor
---

v3.1 — Runtime controls & read-through cache.

- Generic `LRUCache` (lazy TTL, promote-on-get, size cap, hits/misses/hitRate stats) wired into `DatabaseLoader.{load,loadMany,list,stat}` with write invalidation. Configured via `cache.databaseLoader`.
- `MetadataPluginConfig.bootstrap` modes: `eager` (default), `lazy`, `artifact-only`. `artifact-only` requires `artifactSource.mode = 'local-file'`.
- `MetadataManagerConfig.persistence` two-axis write gates: `writable` (gates `register()`) and `overlayWritable` (gates `saveOverlay()`). Both default `true`; either becomes a throw under `validation.throwOnError`.
- Single-source schema discipline: canonical `MetadataManagerConfigSchema` / `MetadataFallbackStrategySchema` live in `kernel/metadata-loader.zod.ts` and are re-exported from `system/metadata-persistence.zod.ts`.
