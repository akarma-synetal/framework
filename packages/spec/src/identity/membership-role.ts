// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Organization membership roles — the ONE list (#3723).
 *
 * A membership role name has to satisfy two independent gatekeepers before a
 * person can actually hold it:
 *
 *  1. **better-auth's organization plugin** must know the name, or
 *     `POST /organization/invite-member` answers `ROLE_NOT_FOUND`. Registration
 *     happens in `auth-manager.ts` (`AuthManagerOptions.additionalOrgRoles`).
 *  2. **`sys_invitation.role` / `sys_member.role`** must list the name as a
 *     `select` option. Both are ENFORCED on write — better-auth's own inserts
 *     run through the ordinary ObjectQL validator, system context and all — so
 *     a value missing from the option list is a role nobody can be stored as.
 *
 * Those were two hand-maintained lists that nothing kept in step: an app
 * declaring a `permission` named `sales_rep` got the role registered with
 * better-auth (step 1) and then watched the `sys_invitation` insert fail with
 * `role must be one of: owner, admin, member` (step 2). `declared ≠ enforced`
 * (Prime Directive #10), one layer below the declaration.
 *
 * The fix is contract-first (Prime Directive #12): this module is the single
 * source both gatekeepers read. The built-ins live here as ordered constants;
 * the app-supplied extras are folded in ONCE, by
 * `plugin-auth/src/org-roles.ts`, which feeds the better-auth role map and the
 * two `select` option lists from the same normalized array. Neither side can
 * accept a name the other rejects, because neither side has its own list.
 *
 * Naming lives here rather than in plugin-auth because the platform objects
 * (`@objectstack/platform-objects`) need the built-in options too, and they
 * must not depend on the auth plugin.
 */

/** better-auth's built-in organization roles. */
export const MEMBERSHIP_ROLE_OWNER = 'owner';
export const MEMBERSHIP_ROLE_ADMIN = 'admin';
export const MEMBERSHIP_ROLE_MEMBER = 'member';

/**
 * [ADR-0105 D8 / #3697] The better-auth organization role that makes the
 * scope-bounded issuance path REACHABLE.
 *
 * D8 authorizes invitation *placement* against the issuer's `adminScope`
 * (ADR-0090 D12) — but better-auth grants `invitation: ["create"]` to `owner`
 * and `admin` only, and under a wall-enforcing posture those two are
 * auto-elevated to tenant admins (`auto-org-admin-grant.ts`), for whom the
 * scope gate narrows nothing. The two sets were disjoint: the gate had no
 * caller. This role is the missing one — a membership grade that may reach
 * `/organization/invite-member` **without** being an org admin.
 *
 * It carries NO ObjectStack authority by construction: `mapMembershipRole`
 * passes it through as a position name, and with no
 * `sys_position_permission_set` binding that name resolves to nothing.
 * Reaching the endpoint is not authority to place — placement authority comes
 * solely from a separately-granted `adminScope`. Role = *can reach the
 * endpoint*; adminScope = *what the endpoint permits*.
 *
 * Doubly opt-in, so a default deployment changes not at all: someone must set
 * the membership role AND grant an adminScope set.
 */
export const MEMBERSHIP_ROLE_DELEGATED_ADMIN = 'delegated_admin';

/**
 * The membership roles the framework itself ships, in display order. Always
 * registered — an app supplies roles IN ADDITION to these, never instead of
 * them (dropping better-auth's `owner` alone would 403 every org mutation).
 */
export const BUILTIN_MEMBERSHIP_ROLES = [
  MEMBERSHIP_ROLE_OWNER,
  MEMBERSHIP_ROLE_ADMIN,
  MEMBERSHIP_ROLE_DELEGATED_ADMIN,
  MEMBERSHIP_ROLE_MEMBER,
] as const;

export type BuiltinMembershipRole = (typeof BUILTIN_MEMBERSHIP_ROLES)[number];

/**
 * `select` options for the built-in roles — the static baseline of
 * `sys_invitation.role` and `sys_member.role`. App roles are appended at boot
 * (see `plugin-auth/src/org-roles.ts`); a deployment whose stack declares none
 * sees exactly this list, unchanged.
 */
export const BUILTIN_MEMBERSHIP_ROLE_OPTIONS: readonly Readonly<{ label: string; value: string }>[] = [
  { label: 'Owner', value: MEMBERSHIP_ROLE_OWNER },
  { label: 'Admin', value: MEMBERSHIP_ROLE_ADMIN },
  { label: 'Delegated Admin', value: MEMBERSHIP_ROLE_DELEGATED_ADMIN },
  { label: 'Member', value: MEMBERSHIP_ROLE_MEMBER },
] as const;

/**
 * The shape a role name must have to survive BOTH gatekeepers unchanged.
 *
 * Identical to `SnakeCaseIdentifierSchema`'s pattern, which every `permission`
 * / `position` name already satisfies — and deliberately so: `Field.select`
 * lowercases option values and strips anything outside `[a-z0-9_]`, so a name
 * like `showcase.export_data` would be registered with better-auth verbatim
 * and stored as `showcaseexport_data`. The two lists would agree on the *name*
 * and still disagree on the *value*. Names that cannot round-trip are refused
 * by `normalizeAdditionalOrgRoles` on both sides rather than half-accepted.
 */
export const MEMBERSHIP_ROLE_NAME_PATTERN = /^[a-z][a-z0-9_]*$/;

/** Minimum length, matching `SnakeCaseIdentifierSchema`. */
export const MEMBERSHIP_ROLE_NAME_MIN_LENGTH = 2;
