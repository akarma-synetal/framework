// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * [#3723] App-declared organization roles — registered once, honoured by both
 * gatekeepers.
 *
 * ## The bug this closes
 *
 * `AuthManagerOptions.additionalOrgRoles` registers app-supplied roles with
 * better-auth's organization plugin so an invitation to `sales_rep` isn't
 * rejected with `ROLE_NOT_FOUND`. better-auth then accepted the role — and the
 * platform objects rejected it:
 *
 * ```
 * POST /organization/invite-member { role: 'sales_rep' }   → passes better-auth
 * insert sys_invitation { role: 'sales_rep' }              → ValidationError:
 *   role must be one of: owner, admin, member
 * ```
 *
 * `sys_invitation.role` and `sys_member.role` are closed `select`s, and a
 * select is ENFORCED on write. better-auth's own inserts are not exempt — its
 * writes run through the ordinary ObjectQL validator, which sits after the
 * security middleware, so `isSystem` context buys nothing. Every deployment
 * whose stack declared `permission` / `position` names was registering roles
 * that could be requested and never stored: `declared ≠ enforced` (Prime
 * Directive #10), one layer below the declaration.
 *
 * ## The shape of the fix (Prime Directive #12 — fix the producer)
 *
 * Not "open the two fields to free text" (that would make better-auth's
 * registry the only authority and drop both the picker's option list and the
 * write-side guardrail), and not "lint that the two lists agree" (that
 * surfaces the mismatch without making app roles work). Instead: **one list,
 * materialized into both consumers**.
 *
 *  - {@link normalizeAdditionalOrgRoles} is the one normalizer. Everything
 *    downstream consumes its output, never a raw caller-supplied array.
 *  - {@link membershipRoleOptions} turns that array into the `select` options.
 *  - {@link withMembershipRoleOptions} stamps those options onto
 *    `sys_invitation` / `sys_member` as `AuthPlugin` registers its manifest.
 *  - `auth-manager.ts` builds better-auth's `roles` map from the SAME
 *    normalized array.
 *
 * Neither side keeps a list of its own, so neither can accept a name the other
 * rejects. The static options in `@objectstack/platform-objects` are the
 * built-in baseline (`BUILTIN_MEMBERSHIP_ROLE_OPTIONS`) and nothing else.
 *
 * ## Why names are filtered rather than passed through
 *
 * `Field.select` lowercases option values and strips everything outside
 * `[a-z0-9_]`. A stack-declared name like `showcase.export_data` would be
 * registered with better-auth verbatim and stored as `showcaseexport_data` —
 * the two lists would agree on the name and still disagree on the value, which
 * is the same bug with extra steps. So a name that cannot round-trip is
 * dropped from BOTH sides with a warning: better-auth never learns it, so the
 * invitation fails loudly at the door (`ROLE_NOT_FOUND`) instead of at the
 * insert. Every `permission` / `position` name that passes its own
 * `SnakeCaseIdentifierSchema` already satisfies this, so a spec-compliant
 * stack loses nothing.
 *
 * ## What registering a role does NOT grant
 *
 * A registered role is an opaque string to better-auth — it gets the built-in
 * `member` access-control statements, never org-admin capability. It does
 * project into `current_user.positions` via `mapMembershipRole`, so a
 * `sys_position_permission_set` binding of the same name resolves permission
 * sets; that is the intended channel (it is why apps declare these roles), and
 * it is capped on the issuing side by `invitation-role-cap.ts` — an issuer
 * below admin grade may invite as plain `member` only.
 */

import {
  BUILTIN_MEMBERSHIP_ROLES,
  BUILTIN_MEMBERSHIP_ROLE_OPTIONS,
  MEMBERSHIP_ROLE_NAME_MIN_LENGTH,
  MEMBERSHIP_ROLE_NAME_PATTERN,
} from '@objectstack/spec/identity';

/** The two better-auth-managed objects whose `role` select is enforced on write. */
export const MEMBERSHIP_ROLE_OBJECTS = ['sys_invitation', 'sys_member'] as const;

/** Field carrying the membership role on each of {@link MEMBERSHIP_ROLE_OBJECTS}. */
const ROLE_FIELD = 'role';

export interface MembershipRoleOption {
  label: string;
  value: string;
}

/** Minimal logger surface — `ctx.logger`, `console`, or nothing at all. */
export interface OrgRoleLogger {
  warn?(message: string): void;
}

const BUILTIN_SET: ReadonlySet<string> = new Set<string>(BUILTIN_MEMBERSHIP_ROLES);

/** `sales_rep` → `Sales Rep`. Display only; the value is always the raw name. */
export function membershipRoleLabel(name: string): string {
  return name
    .split('_')
    .filter((word) => word.length > 0)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * The one normalizer for app-supplied organization roles.
 *
 * Trims, drops non-strings, drops the built-ins (an app cannot redefine
 * `owner`/`admin`/`member`/`delegated_admin` — silently downgrading `owner` to
 * a plain member role would 403 every org mutation), de-duplicates, and
 * refuses names that cannot survive `Field.select`'s value normalization.
 * Order is preserved so the resulting picker is stable across boots.
 *
 * @param logger optional sink for the "dropped an unusable role name" warning
 */
export function normalizeAdditionalOrgRoles(
  input: readonly unknown[] | undefined | null,
  logger?: OrgRoleLogger,
): string[] {
  if (!Array.isArray(input)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of input) {
    if (typeof raw !== 'string') continue;
    const name = raw.trim();
    if (!name) continue;
    if (BUILTIN_SET.has(name)) continue;
    if (seen.has(name)) continue;
    if (name.length < MEMBERSHIP_ROLE_NAME_MIN_LENGTH || !MEMBERSHIP_ROLE_NAME_PATTERN.test(name)) {
      // Loud, not silent: the name is refused on BOTH sides, so an invitation
      // to it fails at better-auth's door rather than at the insert — but the
      // operator still needs to know their stack declared something unusable.
      logger?.warn?.(
        `[auth] organization role '${name}' is not a valid machine name ` +
          `(lowercase snake_case, /^[a-z][a-z0-9_]*$/) — not registered. ` +
          `A name outside that shape cannot be stored on sys_invitation.role / ` +
          `sys_member.role, so registering it would accept invitations that can never be written (#3723).`,
      );
      continue;
    }
    seen.add(name);
    out.push(name);
  }
  return out;
}

/**
 * `select` options for the built-in roles plus `additional` — the exact value
 * set that must be storable on `sys_invitation.role` / `sys_member.role`.
 *
 * Pass an ALREADY-normalized array (the output of
 * {@link normalizeAdditionalOrgRoles}); normalizing again here is harmless but
 * the point of the single normalizer is that callers share one result.
 */
export function membershipRoleOptions(additional: readonly string[] = []): MembershipRoleOption[] {
  return [
    ...BUILTIN_MEMBERSHIP_ROLE_OPTIONS.map((o) => ({ ...o })),
    ...additional
      .filter((name) => !BUILTIN_SET.has(name))
      .map((name) => ({ label: membershipRoleLabel(name), value: name })),
  ];
}

/**
 * Return `objects` with the membership-role selects widened to the full role
 * set — the materialization step that keeps the option lists in step with
 * better-auth's registry.
 *
 * Copy-on-write: the input definitions are module-level singletons shared by
 * every kernel in the process (and by the compile-time
 * `objectstack.config.ts`), so only the touched object / `fields` map / `role`
 * field are cloned. Two kernels booted with different app roles in one test
 * run must not see each other's options.
 *
 * A no-op when the stack declares no extra roles — the overwhelmingly common
 * case gets the identical array back.
 */
export function withMembershipRoleOptions<T>(
  objects: readonly T[],
  additional: readonly string[] = [],
): T[] {
  const extras = additional.filter((name) => !BUILTIN_SET.has(name));
  if (extras.length === 0) return [...objects];

  const options = membershipRoleOptions(extras);
  return objects.map((object) => {
    const def = object as unknown as { name?: unknown; fields?: Record<string, unknown> };
    if (typeof def?.name !== 'string') return object;
    if (!(MEMBERSHIP_ROLE_OBJECTS as readonly string[]).includes(def.name)) return object;
    const field = def.fields?.[ROLE_FIELD] as { type?: unknown } | undefined;
    // Defensive: if the field ever stops being a select, widening its options
    // would be meaningless — leave it exactly as authored rather than invent a
    // shape the validator does not read.
    if (!field || (field.type !== 'select' && field.type !== 'radio')) return object;
    return {
      ...(object as object),
      fields: {
        ...def.fields,
        [ROLE_FIELD]: { ...field, options: options.map((o) => ({ ...o })) },
      },
    } as T;
  });
}

/**
 * Collect the organization roles a loaded stack declares.
 *
 * The producer side of the same one list: `objectstack serve`, the
 * `@objectstack/verify` boot harness and any embedder all derive
 * `additionalOrgRoles` HERE rather than each re-implementing the walk — the
 * harness not doing so is why #3722's unit tests passed while the real HTTP
 * route failed.
 *
 * Sources (better-auth boundary keeps the word "roles"; ADR-0090 D3 exception):
 *   - top-level `positions[]` — flat distribution groups
 *   - top-level `permissions[]` — PermissionSet / Profile names
 *
 * Real RBAC enforcement stays with SecurityPlugin; better-auth only needs to
 * accept the names as opaque strings.
 */
export function collectStackOrgRoles(stack: unknown, logger?: OrgRoleLogger): string[] {
  const names: unknown[] = [];
  const collect = (arr: unknown) => {
    if (!Array.isArray(arr)) return;
    for (const entry of arr) {
      if (typeof entry === 'string') names.push(entry);
      else if (entry && typeof (entry as { name?: unknown }).name === 'string') {
        names.push((entry as { name: string }).name);
      }
    }
  };
  try {
    const config = (stack ?? {}) as { positions?: unknown; permissions?: unknown };
    collect(config.positions);
    collect(config.permissions);
  } catch {
    // Best-effort: a malformed stack must not stop the server from booting.
    return [];
  }
  return normalizeAdditionalOrgRoles(names, logger);
}
