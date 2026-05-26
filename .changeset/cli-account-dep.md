---
'@objectstack/cli': patch
---

Add `@objectstack/account` as a direct dependency of `@objectstack/cli`.

**Bug**: `npx @objectstack/cli start` started the server successfully but visiting `http://localhost:3000/` produced a raw `{"error":"Not found"}` JSON response. Root cause: the Console SPA redirects unauthenticated users to `/_account/login` (hardcoded in the published Console bundle), but the `@objectstack/account` package was never declared as a CLI dependency. The start log even printed `⚠ @objectstack/account not found — skipping Account UI`, yet the Console kept pointing browsers at the missing mount.

**Fix**: declare `@objectstack/account` in `packages/cli/package.json` so `npm install @objectstack/cli` pulls the account portal automatically. Verified end-to-end in a clean `/tmp/test-670-patched` install:
- `npm ls @objectstack/account` → installed
- `/_account/login` → 200 (was 404)
- Navigating to `/` correctly routes through Console → Account `/setup` (the first-run owner-account wizard) instead of dead-ending in the API catch-all.

No change to `@libsql/client` posture — it remains absent from default installs.
