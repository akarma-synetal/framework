---
'@objectstack/plugin-security': minor
---

Add server-side Field-Level Security write enforcement. Client-side
ObjectForm / inline-grid already hides non-editable fields, but the
SecurityPlugin middleware previously only enforced FLS on **read**
(`maskResults` on find/findOne). Insert and update operations could
target any field — a hand-crafted POST bypassed FLS entirely.

The middleware now runs `FieldMasker.detectForbiddenWrites` on every
insert / update payload (single record or bulk array) and throws
`PermissionDeniedError` (HTTP 403) when the payload references a field
the caller is not permitted to edit. The offending field list is
exposed via `details.forbiddenFields` for actionable client error UI.

Allow-list semantics: only fields explicitly enumerated in a
permission set's `fields` map are constrained. System operations
(`ExecutionContext.isSystem`) continue to bypass the check.

Why throw vs. silently stripping: silent strip hides the boundary
from honest clients (partial-save confusion) AND gives probing clients
no signal that the field exists. Throwing makes the boundary
observable in both directions.

Also exposes `FieldMasker.detectForbiddenWrites(data, fieldPermissions)`
as a standalone helper for callers that want to do the check
out-of-band (e.g., adapters that strip-then-warn instead of fail-closed).
