---
'@objectstack/spec': minor
'@objectstack/platform-objects': minor
'@objectstack/plugin-auth': patch
---

**New `account` App for self-service identity management + `App.hidden` shell hint**

Adds a dedicated **Account** App (`name: 'account'`, icon `user-circle`) that exposes the three end-user identity surfaces:

- **Two-Factor Authentication** — `sys_two_factor`
- **Linked Accounts** — `sys_account`
- **OAuth Applications** — `sys_oauth_application`

The app declares **no** `requiredPermissions`, so every authenticated user can reach it — unlike Setup, which requires `setup.access` and therefore excludes the default `member_default` permission set. Combined with the C-tier `resultDialog` actions already shipped on these objects (2FA QR + backup codes, OAuth `client_secret` reveal, `link_social` redirect), this replaces the legacy standalone `apps/account` SPA with a single console + metadata-driven surface.

**New `App.hidden: boolean` field** (`packages/spec/src/ui/app.zod.ts`) hides an app from the top-level App Switcher. Hidden apps stay fully routable and permission-checked; the shell is expected to surface them through the avatar / user dropdown instead. Mirrors the GitHub Settings / Google account chip / Salesforce Personal Settings pattern. The Account app is the first user.

Wiring: `plugin-auth` registers `ACCOUNT_APP` alongside `SETUP_APP` / `STUDIO_APP` (`packages/plugins/plugin-auth/src/auth-plugin.ts`). The legacy duplicate entries inside Setup's Advanced group are kept unchanged — they remain admin-only for tenant-wide inspection.

**Follow-up for objectui**: the shell's `AppSwitcher` and avatar `DropdownMenu` need updating to honour `app.hidden` (filter hidden apps out of the switcher; render them as dropdown menu entries). Tracked separately.
