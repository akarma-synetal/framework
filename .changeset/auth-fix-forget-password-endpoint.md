---
"@objectstack/account": patch
---

Fix forgot-password page returning 404. better-auth's password reset
endpoint is `/api/v1/auth/request-password-reset` (not the legacy
`forget-password`); the account UI now calls the correct path so
the reset email actually dispatches.
