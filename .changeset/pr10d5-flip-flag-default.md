---
"@objectstack/objectql": minor
---

PR-10d.5 — Flip default of `useRepositoryWritePath` to `true`.

`saveMetaItem` now routes overlay-allowed metadata types (view, dashboard,
report, email_template) through `SysMetadataRepository.put` by default —
every write appends to the change log and emits a watch event with a
monotonic `seq` for HMR / replay.

Non-overlay-allowed types (`object`, `flow`, `agent`, ...) still take the
legacy raw-engine path. This preserves control-plane bootstrap behaviour
(which writes `object`/`flow` definitions via `saveMetaItem` and is
permitted by the outer protocol gate to write any type when `projectId`
is undefined).

Opt-out remains available during the deprecation window:
- Constructor: `new ObjectStackProtocolImplementation(engine, …, { useRepositoryWritePath: false })`
- Env var: `OBJECTSTACK_USE_REPOSITORY_WRITE_PATH=0`

The legacy raw-engine branch for overlay-allowed types is scheduled for
removal in PR-10d.6 once this default has soaked for one release.
