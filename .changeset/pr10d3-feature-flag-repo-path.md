---
"@objectstack/objectql": minor
"@objectstack/platform-objects": patch
---

PR-10d.3 — feature flag for `SysMetadataRepository.put` write path in `saveMetaItem`.

- `ObjectStackProtocolImplementation` now accepts an `options.useRepositoryWritePath` flag
  (also honored via `OBJECTSTACK_USE_REPOSITORY_WRITE_PATH=1`) that routes overlay writes
  through `SysMetadataRepository.put`, appending to the change-log and emitting HMR `seq`.
- `saveMetaItem` request grew optional `parentVersion` (If-Match) and `actor` fields.
  `ConflictError` is mapped to a 409 `metadata_conflict` API error.
- Plural metadata type aliases (`views`, `dashboards`, ...) are normalized to singular
  before the repo's overlay-allowlist gate.
- `SysMetadataRepository.put`/`delete` now update/delete by row `id` (the engine's
  strict `.update` semantics require an id or `multi:true`).
- `sys_metadata.checksum` column widened from 64 → 71 chars to hold the `"sha256:"`
  prefix produced by `hashSpec()`.
- Default behaviour unchanged: legacy raw-engine path remains until PR-10d.4 flips the
  flag and removes it.
