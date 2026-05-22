---
'@objectstack/objectql': minor
---

Subscribe `ObjectQLPlugin` to `metadata.subscribe('object', …)` so the
`SchemaRegistry` merge cache is invalidated and the affected object
re-registered on every object metadata change (ADR-0008 M0 PR-7).

Combined with the PR-6 metadata ↔ repository bridge, this closes the
Studio HMR loop end-to-end: editing an object definition (file, REST
write, or Studio inline edit) emits a `MetadataEvent`, which flows
through `MetadataManager.subscribe('object', …)` into ObjectQL, which
drops the cached merged definition and re-fetches the canonical body
from the metadata service. Subsequent reads see the new schema with
no server restart.

Additions:

- `SchemaRegistry.invalidate(fqnOrName)` and `invalidateAll()` —
  public hooks for event-driven cache eviction; contributors are
  preserved so `resolveObject` recomputes against the next call.
- `ObjectQLPlugin.start()` wires the subscription when the metadata
  service exposes `subscribe()`. The handler invalidates, re-fetches
  via `metadata.get('object', name)`, and re-registers with the
  original `packageId` / `namespace`. Deletes only invalidate.
- `ObjectQLPlugin.stop()` drains the subscription handles so test
  reloads don't leak watchers.
