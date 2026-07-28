---
'@objectstack/platform-objects': patch
'@objectstack/plugin-auth': patch
'@objectstack/verify': patch
'@objectstack/spec': patch
'@objectstack/cli': patch
---

fix(auth): app-declared organization roles are now storable, not just registerable (#3723)

`AuthManagerOptions.additionalOrgRoles` registered every `permission` /
`position` name a stack declared with better-auth's organization plugin, so
`POST /organization/invite-member { role: 'sales_rep' }` passed the role check —
and then the write failed, because `sys_invitation.role` and `sys_member.role`
were closed selects listing `owner|admin|member` only:

```
ValidationError: role must be one of: owner, admin, member
  { field: 'role', code: 'invalid_option' }
```

A select is enforced on write and better-auth's own inserts are not exempt (they
run through the ordinary ObjectQL validator), so any stack declaring role names
was registering roles that could be requested and never stored.

Both gatekeepers now read one list. `normalizeAdditionalOrgRoles` is the single
normalizer; its output feeds better-auth's role map **and** the two `select`
option lists, so neither side can accept a name the other rejects. The built-in
roles (`owner`, `admin`, `delegated_admin`, `member`) live in
`@objectstack/spec` as `BUILTIN_MEMBERSHIP_ROLE_OPTIONS`, which is all the
platform objects declare statically — app roles are appended at boot.

New exports:

- `@objectstack/spec` — `MEMBERSHIP_ROLE_{OWNER,ADMIN,MEMBER,DELEGATED_ADMIN}`,
  `BUILTIN_MEMBERSHIP_ROLES`, `BUILTIN_MEMBERSHIP_ROLE_OPTIONS`,
  `MEMBERSHIP_ROLE_NAME_PATTERN`, `MEMBERSHIP_ROLE_NAME_MIN_LENGTH`
  (`MEMBERSHIP_ROLE_DELEGATED_ADMIN` moved from `identity/eval-user.zod` to
  `identity/membership-role`; the package-level export path is unchanged).
- `@objectstack/plugin-auth` — `collectStackOrgRoles`,
  `normalizeAdditionalOrgRoles`, `membershipRoleOptions`,
  `withMembershipRoleOptions`.

Hosts that boot `AuthPlugin` from a loaded stack should derive
`additionalOrgRoles` with `collectStackOrgRoles(stack)` rather than walking the
stack themselves — `objectstack serve` and the `@objectstack/verify` harness now
both do (the harness previously passed none, which is why a dogfood proof could
boot a stack whose declared roles better-auth had never heard of).

Behaviour change worth noting: a declared role name that is not a valid machine
name (`/^[a-z][a-z0-9_]*$/`, min 2 chars) is no longer registered at all, with a
boot warning. `Field.select` strips characters outside `[a-z0-9_]`, so such a
name would be registered verbatim and stored mangled — the same mismatch with
extra steps. Every name that passes `SnakeCaseIdentifierSchema` is unaffected.
