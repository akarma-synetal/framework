---
"@objectstack/plugin-approvals": minor
"@objectstack/spec": patch
---

ADR-0043 actionable approval links (#1743). `remind()` now fans out per approver: every concrete identity gets its own single-use approve/reject links in the notification payload. Tokens are 256-bit, stored as SHA-256 hashes only (`sys_approval_token`), scoped to one request + action + approver, 72h TTL, consumed-before-decide (replay burns), and re-validated at redemption against the live request (decided/recalled/reassigned ⇒ dead link). The plugin mounts a session-less bilingual confirm page at `GET /api/v1/approvals/act` (renders only — mail-gateway prefetch safe) and redeems exclusively on the `POST`, auditing the decision as the bound approver.
