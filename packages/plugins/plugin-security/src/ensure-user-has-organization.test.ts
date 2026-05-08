// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect, vi } from 'vitest';
import { ensureUserHasOrganization } from './ensure-user-has-organization.js';

function makeQL(initial: { members?: any[]; organizations?: any[] } = {}) {
  const members = [...(initial.members ?? [])];
  const organizations = [...(initial.organizations ?? [])];
  const inserts: { object: string; data: any }[] = [];
  const ql: any = {
    find: vi.fn(async (object: string, query: any) => {
      const where = query?.where ?? {};
      if (object === 'sys_member') {
        return members.filter((m) => m.user_id === where.user_id);
      }
      if (object === 'sys_organization') {
        return organizations.filter((o) => o.slug === where.slug);
      }
      return [];
    }),
    insert: vi.fn(async (object: string, data: any) => {
      inserts.push({ object, data });
      if (object === 'sys_organization') organizations.push(data);
      if (object === 'sys_member') members.push(data);
      return data;
    }),
  };
  return { ql, inserts, members, organizations };
}

describe('ensureUserHasOrganization', () => {
  it('returns objectql_unavailable when ql lacks find/insert', async () => {
    const result = await ensureUserHasOrganization({} as any, { id: 'u1' });
    expect(result).toEqual({ created: false, reason: 'objectql_unavailable' });
  });

  it('returns invalid_user when user has no id', async () => {
    const { ql } = makeQL();
    const result = await ensureUserHasOrganization(ql, {} as any);
    expect(result.created).toBe(false);
    expect(result.reason).toBe('invalid_user');
  });

  it('skips users who already have a membership', async () => {
    const { ql, inserts } = makeQL({
      members: [{ id: 'm1', user_id: 'u1', organization_id: 'org1', role: 'owner' }],
    });
    const result = await ensureUserHasOrganization(ql, { id: 'u1', email: 'u@e.com' });
    expect(result).toEqual({ created: false, reason: 'already_member' });
    expect(inserts).toHaveLength(0);
  });

  it('creates a personal org + owner member when user has none', async () => {
    const { ql, inserts } = makeQL();
    const result = await ensureUserHasOrganization(ql, {
      id: 'u1',
      name: 'Alice',
      email: 'alice@example.com',
    });
    expect(result.created).toBe(true);
    expect(result.organizationId).toMatch(/^org_/);
    expect(inserts).toHaveLength(2);
    expect(inserts[0]?.object).toBe('sys_organization');
    expect(inserts[0]?.data.name).toBe("Alice's Workspace");
    expect(inserts[0]?.data.slug).toBe('alice-workspace');
    expect(inserts[1]?.object).toBe('sys_member');
    expect(inserts[1]?.data.role).toBe('owner');
    expect(inserts[1]?.data.user_id).toBe('u1');
    expect(inserts[1]?.data.organization_id).toBe(result.organizationId);
  });

  it('falls back to email local-part when name is missing', async () => {
    const { ql, inserts } = makeQL();
    await ensureUserHasOrganization(ql, { id: 'u1', email: 'bob@example.com' });
    expect(inserts[0]?.data.name).toBe("bob's Workspace");
    expect(inserts[0]?.data.slug).toBe('bob-workspace');
  });

  it('retries with numeric suffix on slug collision', async () => {
    const { ql, inserts } = makeQL({
      organizations: [{ id: 'o1', slug: 'alice-workspace' }],
    });
    const result = await ensureUserHasOrganization(ql, { id: 'u2', name: 'Alice' });
    expect(result.created).toBe(true);
    expect(inserts[0]?.data.slug).toBe('alice-workspace-2');
  });

  it('returns org_insert_failed when org insert throws', async () => {
    const { ql } = makeQL();
    ql.insert = vi.fn(async (object: string) => {
      if (object === 'sys_organization') throw new Error('db down');
      return {};
    });
    const result = await ensureUserHasOrganization(ql, { id: 'u1', name: 'Alice' });
    expect(result.created).toBe(false);
    expect(result.reason).toBe('org_insert_failed');
  });

  it('returns member_insert_failed but keeps org id when member insert throws', async () => {
    const { ql } = makeQL();
    ql.insert = vi.fn(async (object: string, data: any) => {
      if (object === 'sys_member') throw new Error('member fail');
      return data;
    });
    const result = await ensureUserHasOrganization(ql, { id: 'u1', name: 'Alice' });
    expect(result.created).toBe(false);
    expect(result.reason).toBe('member_insert_failed');
    expect(result.organizationId).toMatch(/^org_/);
  });

  it('uses user.id as fallback name if no name and no email', async () => {
    const { ql, inserts } = makeQL();
    await ensureUserHasOrganization(ql, { id: 'user_xyz' });
    expect(inserts[0]?.data.name).toBe("user_xyz's Workspace");
  });
});
