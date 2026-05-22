---
'@objectstack/metadata-core': minor
---

Add `MetadataCache` — bounded, event-invalidated LRU sitting in front of
any `MetadataRepository`. Features:

- Bounded by `maxEntries` and `maxBytes` (default 1024 / 8 MiB).
- LRU eviction with touch-on-read.
- Lazy fill on read miss; negative caching for known-absent items.
- Subscribes to `repo.watch(filter)` and invalidates affected entries
  (including rename: both old and new keys).
- Coalesces concurrent reads for the same key onto a single backend
  fetch (thundering-herd safe).
- Generation counter discards in-flight fetches that race an
  invalidation, preventing stale-cache poisoning.
- Diagnostics via `getStats()` (entries, bytes, hits, misses,
  invalidations, coalesced).

Includes a property-based test that verifies cache→repo convergence
under randomly-generated update sequences.

See ADR-0008 §10 PR-3.
