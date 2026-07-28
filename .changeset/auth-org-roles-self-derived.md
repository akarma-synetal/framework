---
'@objectstack/plugin-auth': minor
'@objectstack/plugin-dev': patch
'@objectstack/verify': patch
'@objectstack/cli': patch
---

feat(auth): AuthPlugin derives app-declared organization roles itself — hosts pass nothing (#3723 follow-up, cloud#897)

Five hosts boot `AuthPlugin` from a stack, and per-host `additionalOrgRoles`
wiring proved to be the defect pattern: three of them (the verify harness,
`DevPlugin`, cloud's `ArtifactKernelFactory`) at some point forgot it, and the
failure is silent — app-declared roles are simply absent. One host (cloud)
mounts `AuthPlugin` before the app metadata even exists, so no init-time walk
could ever cover it.

`AuthPlugin` now derives the roles in its own `kernel:ready` hook — the one
point that fires after all metadata is registered in every host — via the new
`collectRegisteredOrgRoles(engine, metadataService?)` (the late-bound twin of
`collectStackOrgRoles`). Both consumers are updated from the derived union:
better-auth's org-plugin roles map (`applyConfigPatch`; the instance builds
lazily) and the `sys_invitation.role` / `sys_member.role` select options
(re-registration under the same package id — a supported registry path; no
DDL, options are validator/picker metadata).

`objectstack serve`, the `@objectstack/verify` harness and `DevPlugin` no
longer pass `additionalOrgRoles` — deliberately, so the dogfood invite gate
only stays green if the auto-derivation works. The option remains for roles
declared OUTSIDE stack metadata; explicit entries are unioned with the derived
set. `collectStackOrgRoles` stays exported for hosts that want an init-time
walk of a raw stack object.
