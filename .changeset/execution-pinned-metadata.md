---
'@objectstack/spec': minor
'@objectstack/metadata-core': minor
'@objectstack/platform-objects': minor
'@objectstack/objectql': patch
'@objectstack/metadata-fs': patch
'@objectstack/metadata': patch
---

feat(metadata): introduce `executionPinned` capability for runtime version pinning (ADR-0009)

Adds a new capability flag on the metadata type registry so that types whose runtime
transaction rows reference a specific historical version (flow, workflow, approval)
get unified pinning behavior — instead of every business table re-implementing its
own snapshot column.

- `MetadataTypeRegistryEntrySchema` gains `executionPinned: boolean`, enforced
  invariant `executionPinned ⇒ supportsVersioning`.
- `flow`, `workflow`, `approval` flipped to `executionPinned: true`. `approval`
  also corrected to `supportsVersioning: true` (it was wrongly `false`).
- `MetadataRepository.getByHash(ref, hash)` added to the interface. Production
  implementation in `SysMetadataRepository` resolves historical bodies through
  `sys_metadata_history` keyed by `(organization_id, type, name, checksum)`.
  In-memory and FS repositories serve HEAD-only matches.
- `sys_metadata_history` gains an index on `(organization_id, type, name, checksum)`
  to keep hash lookups O(log n).
- `HistoryCleanupManager` skips pinned types entirely (both age-based and
  count-based retention) — pinned-type history must never be GC'd.

See `docs/adr/0009-execution-pinned-metadata.md` for full rationale and the
list of rejected alternatives (no shared snapshot table, no inlined snapshot column).
