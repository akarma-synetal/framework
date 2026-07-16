---
'@objectstack/service-storage': minor
---

feat(attachments): sys_attachment read inherits parent-record visibility (#2970)

Follow-up to #2755. The create/delete gates landed, but a member could still
LIST `sys_attachment` rows (file_name, size, parent_id) pointing at records
they cannot read — an information leak, since attachment access derives from
the PARENT record (Salesforce ContentDocumentLink semantics). `sys_attachment`
is a public system object with no owner field, so the sharing/RLS static
predicates never narrowed it.

`installAttachmentReadVisibility` registers a `sys_attachment`-scoped engine
**middleware** (not a find-hook) so it filters `find`, `findOne`, `count`, and
`aggregate` identically — critically, the list `total` (which comes from
`engine.count()`, never the find path) is filtered too, so it cannot leak the
count of hidden rows. Generalizing ADR-0055 `controlled_by_parent` to the
polymorphic parent, each read resolves the visible parent ids per
`parent_object` through the caller-scoped engine (the parent's own RLS/OWD/
sharing apply) and ANDs a `$or` of `{ parent_object, parent_id: { $in } }`
into the query; no visible parent ⇒ a deny-all sentinel. Fails closed on any
compute error. System / context-less internal reads are not narrowed.
