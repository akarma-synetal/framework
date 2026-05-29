---
'@objectstack/platform-objects': patch
---

Account App: route Profile to a custom React component instead of the
generic sys_user record page.

The Account App's `nav_account_profile` entry switched from
`type: 'object'` (sys_user record, current user id) to
`type: 'component'` with `componentRef: 'account:profile_card'`.
End users now see a settings-form-style "My Profile" card
(avatar / name / password / SSO recovery) registered by the Console
runtime, while the `sys_user` slotted record page (`SysUserDetailPage`)
is unchanged and remains the admin view reached from Setup → Users.

This is a behavioural change for any Studio override that mutates
`nav_account_profile`: the entry no longer has `objectName`,
`recordId`, or `requiresObject`. Override consumers should drop
those fields and target `componentRef: 'account:profile_card'`
(or restore the previous nav item type explicitly).

Requires a Console build that registers `account:profile_card`
(included in the matching `@object-ui/console` release pinned via
`.objectui-sha`).

Verified end-to-end: login → Account App → 个人资料 sidebar item
→ `/_console/apps/account/component/account/profile_card` renders
the React Profile card; editing Name and clicking Save Changes
POSTs `/api/v1/auth/update-user` (200) and persists.

Also removes the `nav_account_preferences` entry that exposed the
raw `sys_user_preference` table as a "Preferences" page in the
Account App. `sys_user_preference` is an internal key-value store
the UI uses for state like `ui.recent`, `ui.favorites`, theme, and
sidebar collapse — not a user-curatable settings surface. A future
`account:preferences_card` React component should provide curated
theme / locale / timezone / notifications toggles when needed.
The corresponding `nav_account_preferences` i18n labels were
removed from all locale bundles (en / es-ES / ja-JP / zh-CN).

The upstream `@object-ui/console` release also fixes a latent
`useState` bug in the same ProfilePage: when mounted under
`<Suspense>` before `AuthProvider` resolves, `user` is null on
first render and `setName(user?.name ?? '')` initialised to `''`
with no follow-up sync. A `useEffect` now mirrors `user.name`
into local state. This was masked when the page was only reached
via the System Hub route (where `AuthGuard` ensured user was
already loaded) and is exposed by the new mount path.
