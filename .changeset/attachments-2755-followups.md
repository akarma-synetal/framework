---
'@objectstack/objectql': minor
'@objectstack/service-storage': minor
'@objectstack/platform-objects': minor
'@objectstack/verify': minor
'@objectstack/rest': patch
---

feat(attachments): sys_file orphan lifecycle + parent-derived attachment access (#2755)

**Orphan lifecycle (ADR-0057).** Deleting a `sys_attachment` join row used to
orphan the backing `sys_file` row and its storage bytes forever. `sys_file`
now declares a lifecycle (`ttl 30d` on a new `deleted_at` tombstone for
orphans; `retention 7d onlyWhen status=pending` for abandoned uploads), the
storage plugin's new hooks tombstone a file when its LAST join row is deleted
(attachments scope only — `Field.file`/`Field.image`/avatar scopes are never
touched) and un-tombstone on re-attach, and a new LifecycleService **reap
guard** seam (`registerReapGuard`) re-verifies zero references at sweep time
and deletes the storage bytes before confirming each row reap. A guarded
object is never blind-deleted; an erroring guard fails safe (rows retained).

**Attachment access (ADR-0049, Salesforce parent-derived semantics).**
`sys_attachment` create now requires caller READ visibility of the parent
record (403 `ATTACHMENT_PARENT_ACCESS`) and server-stamps `uploaded_by` from
the session (client value ignored); delete requires uploader-or-parent-editor
(403 `ATTACHMENT_DELETE_DENIED`). The storage upload routes require an
authenticated session when an auth service is wired (401 `AUTH_REQUIRED`;
bare kernels stay open) and stamp `owner_id` on new files.

**REMOVED — `sys_attachment.share_type` / `sys_attachment.visibility`.**
Both fields were modeled in v1 with zero runtime consumers (ADR-0049
parsed-but-unenforced). There is no replacement key: attachment access is
derived from the parent record by the hooks above. Writers of these fields
should simply stop sending them (unknown-field validation will reject them);
existing DB columns are left as unmanaged leftovers, no migration needed.

`@objectstack/verify` gains `BootOptions.extraPlugins` for booting optional
service pairs (e.g. storage + audit) in dogfood fixtures.
