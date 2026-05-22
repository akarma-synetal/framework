---
"@objectstack/objectql": patch
---

fix(objectql): SysMetadataRepository reuses the existing `checksum` column
instead of writing a non-existent `_hash` column (ADR-0008 PR-10d.2). The
production `sys_metadata` schema (`packages/platform-objects`) already
ships with `checksum: text(64)` — perfect for sha256 hex — and `version:
number` for the monotonic counter. No DDL migration is required for
PR-10d.3 cutover; legacy rows with NULL checksum will be lazily
backfilled on first put().

Also extends the PR-10d.1 dry-run probe with two new checks
(`checksum_missing` warning, `checksum_drift` error) and three additional
tests, taking objectql to 325/325 green.
