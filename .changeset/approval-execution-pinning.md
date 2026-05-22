---
'@objectstack/plugin-approvals': minor
'@objectstack/platform-objects': minor
'@objectstack/spec': patch
'@objectstack/metadata-core': patch
---

feat(approvals): execution-pinned approval processes (ADR-0009)

When an approval request is submitted, the engine now records a `process_hash`
on `sys_approval_request` — the sha256 of the approval process body resolved
through `MetadataRepository`. While the request is in flight, `approve` /
`reject` / `recall` resolve the pinned process body via
`MetadataRepository.getByHash`. Upgrading the approval process definition
mid-flight therefore no longer affects requests that already started against
the previous version.

Behavior:

- `sys_approval_request` gains a `process_hash` column (text, nullable,
  read-only). Existing rows keep working — the engine falls back to the
  current `sys_approval_process` projection when the column is empty.
- `ApprovalServiceOptions` accepts an optional `metadataRepo`. When omitted
  (e.g. defining processes purely through the runtime API or in unit tests),
  pinning is silently disabled and the service behaves as before.
- `ApprovalsServicePlugin` looks up the metadata service from the kernel
  and wires its repository automatically.
- The metadata-core local `MetadataTypeSchema` enum was realigned with the
  canonical `@objectstack/spec/kernel` enum (drift fix: `approval`, `field`,
  `function`, `service`, …).

This is the first user-visible consumer of the `executionPinned` capability
introduced in ADR-0009.
