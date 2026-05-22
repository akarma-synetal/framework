---
'@objectstack/spec': minor
'@objectstack/objectql': minor
'@objectstack/rest': minor
'@objectstack/client': minor
---

feat: Optimistic Concurrency Control (OCC) via `If-Match`

Update and Delete requests now accept an optional version token. When supplied,
the protocol compares it against the record's current `updated_at` (or `version`
column when available) and rejects with `409 CONCURRENT_UPDATE` on mismatch,
preventing silent overwrites when two clients edit the same record.

**Wire formats** (opt-in, all server- and client-backward-compatible):

- `PATCH /data/{object}/{id}` — supports `If-Match: "<token>"` header
  *or* `expectedVersion: "<token>"` body field (body wins when both present).
- `DELETE /data/{object}/{id}` — supports `If-Match` header *or*
  `?expectedVersion=...` query param.
- Conflict response: `409 { error, code: 'CONCURRENT_UPDATE', currentVersion,
  currentRecord }` so the client can offer Reload / Overwrite / Cancel UX.

**Behaviour**

- Missing/empty version → no check (legacy callers unaffected).
- Record not found during the version probe → no check; the downstream write
  produces a normal `404`.
- Object has no `updated_at` column → no check (explicit opt-out for objects
  without timestamps).
- Quoted RFC-7232 tokens (`"…"`) are accepted and unquoted before comparison.

**Client**

`client.data.update(resource, id, data, { ifMatch })` and
`client.data.delete(resource, id, { ifMatch })` now forward the token as an
`If-Match` header.

Application-level CAS (findOne + compare in protocol.ts) is used in this slice
to avoid touching every storage driver. A small TOCTOU window remains; for the
B2B record-editing latencies this protects against, it is more than sufficient.
Drivers may later be upgraded to atomic `WHERE id=? AND updated_at=?` writes
for true CAS without changing the public API.

Tests: 7 new cases in `protocol-data.test.ts` cover opt-in, match, mismatch,
quote-stripping, no-timestamps, empty-token, and the delete path.
