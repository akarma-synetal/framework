---
'@objectstack/platform-objects': patch
---

Fix two self-service identity action bugs:

- `sys_two_factor` was missing the `verified` boolean column that better-auth's two-factor plugin writes during enrollment. Without it the `/2fa/enable` endpoint 500'd with `table sys_two_factor has no column named verified`. Added `Field.boolean({ defaultValue: true })` to match the better-auth schema.
- `sys_account.link_social` action's `callbackURL` still pointed at the pre-migration Setup path (`/apps/setup/system/sys_account`). Updated to `/apps/account/sys_account` so users land back on the linked-accounts view after the OAuth dance.
