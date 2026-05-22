---
"@objectstack/platform-objects": patch
---

Deprecate `sys_metadata_history.metadata_id`.

The column was originally a `Field.lookup` FK into `sys_metadata.id` and
was downgraded to plain `text` during the M1 history-writes work so
that DELETE tombstones could hold an orphaned ref. On revisit, the
column carries no business value:

- Audit-time joins use the natural composite key
  `(organization_id, type, name, version)`, which is already UNIQUE.
- The physical row id is a database-internal detail; it cannot be used
  to "follow" a logical identity through recreations.
- No code reader has ever been added.

This release marks the field `@deprecated` in TSDoc and flags the
column description in Studio. `SysMetadataRepository` and the legacy
`DatabaseLoader` continue to populate it across this major so existing
backups remain queryable; the column will be dropped from the schema in
the next major release. No migration is required for consumers: switch
joins to `(organization_id, type, name, version)`.

See ADR-0008 §14 for the full rationale.
