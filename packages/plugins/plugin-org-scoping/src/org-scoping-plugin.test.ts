// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect, vi } from 'vitest';
import { OrgScopingPlugin } from './org-scoping-plugin.js';

function makeCtx(extraServices: Record<string, any> = {}) {
  const middlewares: any[] = [];
  const baseSchema = {
    name: 'task',
    fields: {
      id: { name: 'id' },
      organization_id: { name: 'organization_id' },
      owner_id: { name: 'owner_id' },
      name: { name: 'name' },
    },
  };
  const ql: any = {
    registerMiddleware: (mw: any) => middlewares.push(mw),
    getSchema: () => baseSchema,
    find: vi.fn(async () => []),
    insert: vi.fn(async () => ({ id: 'x' })),
  };
  const metadata: any = { get: async () => baseSchema };
  const services: Record<string, any> = {
    manifest: { register: vi.fn() },
    objectql: ql,
    metadata,
    ...extraServices,
  };
  const registered: Record<string, any> = {};
  const ctx: any = {
    logger: { info: vi.fn(), warn: vi.fn() },
    registerService: (name: string, svc: any) => {
      registered[name] = svc;
      services[name] = svc;
    },
    getService: (name: string) => {
      if (!(name in services)) throw new Error(`service not registered: ${name}`);
      return services[name];
    },
  };
  return { ctx, ql, middlewares, registered };
}

describe('OrgScopingPlugin', () => {
  it('has correct metadata', () => {
    const plugin = new OrgScopingPlugin();
    expect(plugin.name).toBe('com.objectstack.org-scoping');
    expect(plugin.version).toBe('1.0.0');
    expect(plugin.dependencies).toContain('com.objectstack.engine.objectql');
  });

  it('registers itself as `org-scoping` service during init', async () => {
    const plugin = new OrgScopingPlugin();
    const { ctx, registered } = makeCtx();
    await plugin.init(ctx);
    expect(registered['org-scoping']).toBe(plugin);
  });

  it('auto-stamps organization_id on insert from tenantId', async () => {
    const plugin = new OrgScopingPlugin();
    const { ctx, middlewares } = makeCtx();
    await plugin.init(ctx);
    await plugin.start(ctx);
    const insertMw = middlewares[0];
    const opCtx: any = {
      object: 'task',
      operation: 'insert',
      data: { name: 'A' },
      context: { userId: 'u1', tenantId: 'org-1' },
    };
    await insertMw(opCtx, async () => {});
    expect(opCtx.data.organization_id).toBe('org-1');
  });

  it('does not overwrite an explicit organization_id', async () => {
    const plugin = new OrgScopingPlugin();
    const { ctx, middlewares } = makeCtx();
    await plugin.init(ctx);
    await plugin.start(ctx);
    const opCtx: any = {
      object: 'task',
      operation: 'insert',
      data: { name: 'A', organization_id: 'explicit-org' },
      context: { userId: 'u1', tenantId: 'org-1' },
    };
    await middlewares[0](opCtx, async () => {});
    expect(opCtx.data.organization_id).toBe('explicit-org');
  });

  it('skips auto-stamping in system context', async () => {
    const plugin = new OrgScopingPlugin();
    const { ctx, middlewares } = makeCtx();
    await plugin.init(ctx);
    await plugin.start(ctx);
    const opCtx: any = {
      object: 'task',
      operation: 'insert',
      data: { name: 'A' },
      context: { isSystem: true, tenantId: 'org-1' },
    };
    await middlewares[0](opCtx, async () => {});
    expect(opCtx.data.organization_id).toBeUndefined();
  });

  it('no-ops when tenantId is absent', async () => {
    const plugin = new OrgScopingPlugin();
    const { ctx, middlewares } = makeCtx();
    await plugin.init(ctx);
    await plugin.start(ctx);
    const opCtx: any = {
      object: 'task',
      operation: 'insert',
      data: { name: 'A' },
      context: { userId: 'u1' },
    };
    await middlewares[0](opCtx, async () => {});
    expect(opCtx.data.organization_id).toBeUndefined();
  });

  it('skips when target object has no organization_id field', async () => {
    const plugin = new OrgScopingPlugin();
    const { ctx, middlewares } = makeCtx();
    // Replace schema so the column does not exist.
    (ctx.getService('objectql') as any).getSchema = () => ({
      name: 'task',
      fields: { id: { name: 'id' }, name: { name: 'name' } },
    });
    await plugin.init(ctx);
    await plugin.start(ctx);
    const opCtx: any = {
      object: 'task',
      operation: 'insert',
      data: { name: 'A' },
      context: { userId: 'u1', tenantId: 'org-1' },
    };
    await middlewares[0](opCtx, async () => {});
    expect(opCtx.data.organization_id).toBeUndefined();
  });
});
