// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * [#3723] The two gatekeepers read one list.
 *
 * The bug: `additionalOrgRoles` registered a role with better-auth that the
 * `sys_invitation.role` / `sys_member.role` selects then rejected on write —
 * two hand-maintained lists nothing kept in step. These tests pin the
 * invariant that replaced them: whatever `normalizeAdditionalOrgRoles` yields
 * is EXACTLY what both sides see, and neither side has a list of its own.
 */

import { describe, it, expect, vi } from 'vitest';
import { BUILTIN_MEMBERSHIP_ROLE_OPTIONS } from '@objectstack/spec/identity';
import { SysInvitation, SysMember, SysUser } from '@objectstack/platform-objects/identity';
import {
  collectStackOrgRoles,
  membershipRoleLabel,
  membershipRoleOptions,
  normalizeAdditionalOrgRoles,
  withMembershipRoleOptions,
} from './org-roles.js';

const values = (options: readonly { value: string }[]) => options.map((o) => o.value);
const roleOptionsOf = (object: unknown): { label: string; value: string }[] =>
  ((object as { fields: Record<string, { options?: { label: string; value: string }[] }> }).fields
    .role.options ?? []);

describe('#3723 normalizeAdditionalOrgRoles — the one normalizer', () => {
  it('keeps valid app role names, in declaration order', () => {
    expect(normalizeAdditionalOrgRoles(['sales_rep', 'sales_manager', 'service_agent'])).toEqual([
      'sales_rep',
      'sales_manager',
      'service_agent',
    ]);
  });

  it('drops the built-ins — an app may not redefine owner/admin/member/delegated_admin', () => {
    // Silently downgrading `owner` to a plain-member role would strip its
    // `invitation:create` and 403 every org mutation.
    expect(
      normalizeAdditionalOrgRoles(['owner', 'admin', 'member', 'delegated_admin', 'sales_rep']),
    ).toEqual(['sales_rep']);
  });

  it('de-duplicates and trims', () => {
    expect(normalizeAdditionalOrgRoles(['  sales_rep ', 'sales_rep', ''])).toEqual(['sales_rep']);
  });

  it('ignores non-strings and a non-array input', () => {
    expect(normalizeAdditionalOrgRoles([null, 42, {}, 'sales_rep'] as unknown[])).toEqual(['sales_rep']);
    expect(normalizeAdditionalOrgRoles(undefined)).toEqual([]);
    expect(normalizeAdditionalOrgRoles(null)).toEqual([]);
  });

  it('REFUSES a name that cannot round-trip through Field.select — loudly', () => {
    // `Field.select` lowercases values and strips everything outside
    // [a-z0-9_], so `showcase.export_data` would be registered with
    // better-auth verbatim and stored as `showcaseexport_data`: the two lists
    // agreeing on the name and disagreeing on the value is the same bug.
    const warn = vi.fn();
    expect(
      normalizeAdditionalOrgRoles(
        ['showcase.export_data', 'Sales Rep', '_leading', 'x', 'sales_rep'],
        { warn },
      ),
    ).toEqual(['sales_rep']);
    expect(warn).toHaveBeenCalledTimes(4);
    expect(warn.mock.calls.map((c) => String(c[0])).join('\n')).toContain('showcase.export_data');
  });

  it('is idempotent — AuthPlugin normalizes, AuthManager re-normalizes, same array', () => {
    const once = normalizeAdditionalOrgRoles(['sales_rep', 'owner', 'bad.name']);
    expect(normalizeAdditionalOrgRoles(once)).toEqual(once);
  });
});

describe('#3723 membershipRoleOptions — the option list both selects get', () => {
  it('is the built-in baseline when the stack declares nothing', () => {
    expect(membershipRoleOptions()).toEqual([...BUILTIN_MEMBERSHIP_ROLE_OPTIONS]);
  });

  it('appends app roles after the built-ins, with humanized labels', () => {
    const options = membershipRoleOptions(['sales_rep']);
    expect(values(options)).toEqual(['owner', 'admin', 'delegated_admin', 'member', 'sales_rep']);
    expect(options.at(-1)).toEqual({ label: 'Sales Rep', value: 'sales_rep' });
  });

  it('never duplicates a built-in', () => {
    expect(values(membershipRoleOptions(['member', 'sales_rep']))).toEqual([
      'owner',
      'admin',
      'delegated_admin',
      'member',
      'sales_rep',
    ]);
  });

  it('humanizes labels without ever changing the stored value', () => {
    expect(membershipRoleLabel('sales_rep')).toBe('Sales Rep');
    expect(membershipRoleLabel('ops')).toBe('Ops');
    expect(membershipRoleOptions(['field_ops_delegate']).at(-1)).toEqual({
      label: 'Field Ops Delegate',
      value: 'field_ops_delegate',
    });
  });
});

describe('#3723 withMembershipRoleOptions — materializing onto the platform objects', () => {
  const objects = [SysUser, SysMember, SysInvitation];

  it('widens BOTH role selects — fixing one leaves the other rejecting the same value', () => {
    // The lesson from #3722: `sys_member.role` alone still left
    // `sys_invitation.role` refusing the invitation at issuance.
    const [, member, invitation] = withMembershipRoleOptions(objects, ['sales_rep']);
    expect(values(roleOptionsOf(member))).toContain('sales_rep');
    expect(values(roleOptionsOf(invitation))).toContain('sales_rep');
    expect(values(roleOptionsOf(member))).toEqual(values(roleOptionsOf(invitation)));
  });

  it('leaves unrelated objects untouched, by identity', () => {
    const [user] = withMembershipRoleOptions(objects, ['sales_rep']);
    expect(user).toBe(SysUser);
  });

  it('is copy-on-write — the shared module-level definitions are never mutated', () => {
    // `authIdentityObjects` is a process-wide singleton also used by the
    // compile-time `objectstack.config.ts`; two kernels booted with different
    // app roles in one test run must not see each other's options.
    withMembershipRoleOptions(objects, ['sales_rep']);
    expect(values(roleOptionsOf(SysMember))).toEqual(values(BUILTIN_MEMBERSHIP_ROLE_OPTIONS));
    expect(values(roleOptionsOf(SysInvitation))).toEqual(values(BUILTIN_MEMBERSHIP_ROLE_OPTIONS));

    const a = withMembershipRoleOptions(objects, ['role_a']);
    const b = withMembershipRoleOptions(objects, ['role_b']);
    expect(values(roleOptionsOf(a[1]))).toContain('role_a');
    expect(values(roleOptionsOf(a[1]))).not.toContain('role_b');
    expect(values(roleOptionsOf(b[1]))).toContain('role_b');
  });

  it('no app roles → the built-in baseline, unchanged', () => {
    const [, member] = withMembershipRoleOptions(objects, []);
    expect(values(roleOptionsOf(member))).toEqual(values(BUILTIN_MEMBERSHIP_ROLE_OPTIONS));
  });

  it('the static definitions carry the built-ins ONLY — extras come from here', () => {
    // A drift guard: hand-adding a role to either object file would re-create
    // the two-lists problem from the other direction (an option better-auth
    // never registered, so the picker offers a role that 400s at the door).
    expect(values(roleOptionsOf(SysMember))).toEqual(values(BUILTIN_MEMBERSHIP_ROLE_OPTIONS));
    expect(values(roleOptionsOf(SysInvitation))).toEqual(values(BUILTIN_MEMBERSHIP_ROLE_OPTIONS));
  });
});

describe('#3723 collectStackOrgRoles — one walk for every host', () => {
  it('collects position and permission names from a loaded stack', () => {
    const roles = collectStackOrgRoles({
      positions: [{ name: 'sales_rep' }, { name: 'sales_manager' }],
      permissions: [{ name: 'sales_user' }, { name: 'guest_portal' }],
    });
    expect(roles).toEqual(['sales_rep', 'sales_manager', 'sales_user', 'guest_portal']);
  });

  it('accepts bare strings as well as named entries', () => {
    expect(collectStackOrgRoles({ positions: ['sales_rep', { name: 'ops' }] })).toEqual([
      'sales_rep',
      'ops',
    ]);
  });

  it('normalizes on the way out — the built-ins never leak into the extras', () => {
    expect(
      collectStackOrgRoles({ positions: [{ name: 'member' }, { name: 'owner' }, { name: 'ops' }] }),
    ).toEqual(['ops']);
  });

  it('a stack with no role metadata yields nothing (and does not throw)', () => {
    expect(collectStackOrgRoles({})).toEqual([]);
    expect(collectStackOrgRoles(undefined)).toEqual([]);
    expect(collectStackOrgRoles({ positions: 'not-an-array', permissions: 7 })).toEqual([]);
  });

  it('feeds the option list directly — collection and materialization agree', () => {
    const stack = { permissions: [{ name: 'sales_user' }] };
    const roles = collectStackOrgRoles(stack);
    const [, member] = withMembershipRoleOptions([SysUser, SysMember], roles);
    expect(values(roleOptionsOf(member))).toContain('sales_user');
  });
});
