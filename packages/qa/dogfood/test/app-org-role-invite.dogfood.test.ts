// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * [#3723] An app-declared organization role is usable end to end — proven over
 * the real HTTP route, because no unit test could have caught this.
 *
 * The bug: `additionalOrgRoles` registered every `permission` / `position` name
 * a stack declared with better-auth's organization plugin, so
 * `POST /organization/invite-member { role: 'contributor' }` passed the role
 * check — and then the `sys_invitation` insert failed, because
 * `sys_invitation.role` and `sys_member.role` were closed selects listing only
 * `owner|admin|member`. Two lists that had to agree, with nothing keeping them
 * in step: `declared ≠ enforced` (Prime Directive #10) one layer below the
 * declaration.
 *
 * ```
 * ValidationError: role must be one of: owner, admin, member
 *   { field: 'role', code: 'invalid_option', options: ['owner','admin','member'] }
 * ```
 *
 * The fix folds both consumers into one normalized list (see
 * `plugin-auth/src/org-roles.ts`). This file is the gate on the whole chain:
 * the showcase stack declares `contributor` as a `position` and
 * `showcase_manager` as a `permission`, both of which travel
 * stack → `collectStackOrgRoles` → better-auth registry AND the two selects.
 *
 * Why here and not a unit test: #3722's unit tests proved the roles map was
 * built correctly and still shipped an unusable role — the failure only
 * appears when the real route drives a real insert through the ObjectQL
 * validator. Twice, in fact, once per object, which is why both are asserted.
 *
 * Harness note (also #3723): `bootStack` now derives `additionalOrgRoles` from
 * the stack exactly as `objectstack serve` does. Before that it passed none, so
 * a dogfood proof booted a stack whose declared roles better-auth had never
 * heard of — the one surface that drives the real route was blind to this
 * class of bug.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import showcaseStack from '@objectstack/example-showcase';
import { bootStack, type VerifyStack } from '@objectstack/verify';

const SYSTEM_CTX = { isSystem: true };

/** A `position` the showcase stack declares — an app role by the position route. */
const APP_ROLE_POSITION = 'contributor';
/** A `permission` (PermissionSet) the showcase stack declares — the other route. */
const APP_ROLE_PERMISSION_SET = 'showcase_manager';

async function findRows(ql: any, object: string, where: any, limit = 50): Promise<any[]> {
  const rows = await ql.find(object, { where, limit }, { context: SYSTEM_CTX });
  return Array.isArray(rows) ? rows : (rows?.records ?? []);
}

async function waitForMembership(ql: any, userId: string): Promise<any> {
  for (let i = 0; i < 40; i++) {
    const rows = await findRows(ql, 'sys_member', { user_id: userId }, 5);
    if (rows.length > 0) return rows[0];
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`no sys_member row appeared for ${userId}`);
}

describe('#3723: an app-declared org role can actually be invited and held', () => {
  let stack: VerifyStack;
  let ql: any;
  let orgId: string;
  let ownerToken: string;

  beforeAll(async () => {
    stack = await bootStack(showcaseStack, {});
    ownerToken = await stack.signIn(); // the seeded dev admin
    ql = await stack.kernel.getServiceAsync<any>('objectql');

    // `bootStack` disables the default-org bootstrap, so mint the org the way
    // the bootstrap would (system context — the only writer better-auth-managed
    // tables accept, ADR-0092) and bind the dev admin as its owner.
    const org = await ql.insert(
      'sys_organization',
      { name: 'Default Organization', slug: 'default' },
      { context: SYSTEM_CTX },
    );
    orgId = String(org.id);

    const [adminUser] = await findRows(ql, 'sys_user', { email: 'admin@objectos.ai' }, 1);
    const adminMembers = await findRows(ql, 'sys_member', { user_id: adminUser.id }, 5);
    if (adminMembers.length > 0) {
      await ql.update(
        'sys_member',
        { id: adminMembers[0].id, organization_id: orgId, role: 'owner' },
        { context: SYSTEM_CTX },
      );
    } else {
      await ql.insert(
        'sys_member',
        { user_id: adminUser.id, organization_id: orgId, role: 'owner' },
        { context: SYSTEM_CTX },
      );
    }
  }, 180_000);

  afterAll(async () => {
    await stack?.stop?.();
  });

  it('both role selects offer the stack-declared roles — one list, two consumers', async () => {
    // The registered schema is what the write-path validator reads AND what the
    // Setup picker renders, so this is both halves of "the option list agrees
    // with better-auth's registry".
    const optionValues = async (object: string) => {
      const schema = await ql.getSchema(object);
      return (schema.fields.role.options ?? []).map((o: any) => o.value);
    };

    const invitationRoles = await optionValues('sys_invitation');
    const memberRoles = await optionValues('sys_member');

    // The built-ins are never dropped — better-auth's `hasPermission` spreads
    // our map over its defaults, so losing `owner` would 403 every mutation.
    expect(invitationRoles).toEqual(expect.arrayContaining(['owner', 'admin', 'member']));
    // …and the app's own roles are there, from both declaration routes.
    expect(invitationRoles).toContain(APP_ROLE_POSITION);
    expect(invitationRoles).toContain(APP_ROLE_PERMISSION_SET);
    // Fixing one object and not the other is exactly how #3722 failed twice.
    expect(memberRoles).toEqual(invitationRoles);
  }, 30_000);

  it('the picker shows the DECLARED label, not a title-cased machine name', async () => {
    // The showcase position `exec` declares `label: 'Executive'`. Deriving the
    // option label from the machine name would render "Exec" — a third source
    // of truth for a string the position metadata already owns. Same one-list
    // principle as the role set itself, applied to how it is displayed.
    const schema = await ql.getSchema('sys_member');
    const options = (schema.fields.role.options ?? []) as { label: string; value: string }[];
    const exec = options.find((o) => o.value === 'exec');
    expect(exec, `no 'exec' option among ${options.map((o) => o.value).join(', ')}`).toBeDefined();
    expect(exec!.label).toBe('Executive');
    expect(exec!.label).not.toBe('Exec');
  }, 30_000);

  it('inviting with an app-declared role SUCCEEDS — this is the reported failure', async () => {
    // Before the fix: 200 from better-auth's role check, then the sys_invitation
    // insert threw `role must be one of: owner, admin, member`.
    const email = 'invitee.contributor.3723@example.com';
    const res = await stack.apiAs(ownerToken, 'POST', '/auth/organization/invite-member', {
      email,
      role: APP_ROLE_POSITION,
      organizationId: orgId,
    });

    expect(res.status, await res.clone().text()).toBe(200);
    const rows = await findRows(ql, 'sys_invitation', { email }, 5);
    expect(rows.length).toBe(1);
    expect(rows[0].role).toBe(APP_ROLE_POSITION);
  }, 30_000);

  it('a PermissionSet name works too — both collection routes reach the same list', async () => {
    const email = 'invitee.manager.3723@example.com';
    const res = await stack.apiAs(ownerToken, 'POST', '/auth/organization/invite-member', {
      email,
      role: APP_ROLE_PERMISSION_SET,
      organizationId: orgId,
    });

    expect(res.status, await res.clone().text()).toBe(200);
    const rows = await findRows(ql, 'sys_invitation', { email }, 5);
    expect(rows[0].role).toBe(APP_ROLE_PERMISSION_SET);
  }, 30_000);

  it('the membership row accepts the same role — the second enforced select', async () => {
    // The value the invitation lands on `sys_member` as. Written here through
    // ObjectQL rather than by accepting the invitation because the signup
    // reconciler has already bound this user to the org (better-auth refuses a
    // second membership), but it is the SAME validator on the same enforced
    // select that better-auth's acceptance insert goes through — system context
    // does not exempt it, which is the whole reason the bug existed.
    const token = await stack.signUp('holder.3723@example.com', 'Holder!Pass123', 'Holder 3723');
    expect(token).toBeTruthy();
    const [user] = await findRows(ql, 'sys_user', { email: 'holder.3723@example.com' }, 1);
    const membership = await waitForMembership(ql, String(user.id));

    await ql.update(
      'sys_member',
      { id: membership.id, organization_id: orgId, role: APP_ROLE_POSITION },
      { context: SYSTEM_CTX },
    );

    const [updated] = await findRows(ql, 'sys_member', { id: membership.id }, 1);
    expect(updated.role).toBe(APP_ROLE_POSITION);
  }, 60_000);

  it('a role the stack never declared is still refused — the fields did not just open up', async () => {
    // Option 1 in the issue (make both fields free text) would have made this
    // pass. It must not: the write-side guardrail and the picker's option list
    // are the reason to keep a closed select, and better-auth's registry is
    // still the gate at the door.
    const email = 'invitee.undeclared.3723@example.com';
    const res = await stack.apiAs(ownerToken, 'POST', '/auth/organization/invite-member', {
      email,
      role: 'not_a_declared_role',
      organizationId: orgId,
    });

    expect(res.status).not.toBe(200);
    expect((await findRows(ql, 'sys_invitation', { email }, 5)).length).toBe(0);
  }, 30_000);
});
