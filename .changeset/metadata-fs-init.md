---
'@objectstack/metadata-fs': minor
'@objectstack/metadata-core': patch
---

Add `@objectstack/metadata-fs` — Node-only `FileSystemRepository`
implementation of the M0 Repository contract.

Layout:

```
<root>/
  <type>/<name>.json          # canonical body (atomic rename writes)
  .objectstack/.log/<branch>.jsonl   # append-only change log
```

Features:

- All 17 contract tests pass (`singleBranch: true`).
- Per-key serialization via `KeyedMutex`.
- Atomic writes via tmpfile + rename.
- Heads and `seq` recovered from the JSONL log on `start()` — survives
  process restart.
- chokidar watcher translates external edits (e.g. VSCode saves) into
  `MetadataEvent`s with `source: 'fs'`.
- Self-write suppression: 200ms window prevents the watcher from
  re-emitting events for files we wrote ourselves.
- Manual `AsyncIterator` for `watch()` to mirror the in-memory pattern.

Also (`metadata-core`):

- Add `singleBranch` option to `runRepositoryContractTests` so
  single-branch backends (like the FS one) skip the cross-branch test.
- Switch tsup `splitting: true` so `index.js` and `testing.js` share a
  single `ConflictError` class identity (was double-bundled before).

See ADR-0008 §10 PR-4.
