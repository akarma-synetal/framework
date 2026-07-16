// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect, vi } from 'vitest';
import { installAttachmentReadVisibility } from './attachment-access-hooks.js';
import type { AttachmentLifecycleEngine, AttachmentReadMiddlewareCtx } from './attachment-lifecycle.js';

const silentLogger = () => ({ info: vi.fn(), warn: vi.fn(), debug: vi.fn() });

/**
 * Fake engine modelling: a sys_attachment table (system pre-scan) + a
 * per-parent-object visibility map keyed by userId. A parent find under a
 * caller context returns only the ids that user can see.
 */
function install(opts: {
  attachments: Array<{ parent_object: string; parent_id: string; id?: string }>;
  /** parentObject -> userId -> visible parent ids */
  visible: Record<string, Record<string, string[]>>;
}) {
  let mw!: (ctx: AttachmentReadMiddlewareCtx, next: () => Promise<void>) => Promise<void>;
  const calls = { parentFinds: [] as Array<{ object: string; ids: string[]; userId?: string }> };

  const matchWhere = (row: any, where: any): boolean => {
    if (!where || typeof where !== 'object') return true;
    return Object.entries(where).every(([k, v]) => {
      if (v && typeof v === 'object' && Array.isArray((v as any).$in)) {
        return (v as any).$in.map(String).includes(String(row[k]));
      }
      return String(row[k]) === String(v);
    });
  };

  const engine: AttachmentLifecycleEngine = {
    registerHook: () => {},
    registerMiddleware: (fn) => {
      mw = fn as any;
    },
    find: async (object: string, options: any) => {
      if (object === 'sys_attachment') {
        // system candidate pre-scan
        const rows = opts.attachments.filter((r) => matchWhere(r, options?.where));
        return rows.slice(0, options?.limit ?? rows.length) as any;
      }
      // caller-scoped parent visibility probe
      const userId = options?.context?.userId as string | undefined;
      const ids: string[] = (options?.where?.id?.$in ?? []).map(String);
      calls.parentFinds.push({ object, ids, userId });
      const vis = opts.visible[object]?.[userId ?? ''] ?? [];
      return ids.filter((id) => vis.includes(id)).map((id) => ({ id })) as any;
    },
    findOne: async () => null,
    update: async () => ({}),
  };
  installAttachmentReadVisibility(engine, silentLogger());
  return { mw, calls };
}

/** Drive a read op through the middleware and return the resulting where. */
async function runRead(
  mw: (ctx: AttachmentReadMiddlewareCtx, next: () => Promise<void>) => Promise<void>,
  ctxPartial: Partial<AttachmentReadMiddlewareCtx>,
) {
  const ctx: AttachmentReadMiddlewareCtx = {
    object: 'sys_attachment',
    operation: 'find',
    ast: { object: 'sys_attachment', where: undefined },
    context: { userId: 'u1' },
    ...ctxPartial,
  };
  let ran = false;
  await mw(ctx, async () => {
    ran = true;
  });
  return { where: ctx.ast?.where, ran };
}

describe('installAttachmentReadVisibility', () => {
  const dataset = {
    attachments: [
      { id: 'a1', parent_object: 'att_case', parent_id: 'c1' },
      { id: 'a2', parent_object: 'att_case', parent_id: 'c2' }, // invisible to u1
      { id: 'a3', parent_object: 'att_secret', parent_id: 's1' }, // invisible to u1
    ],
    visible: {
      att_case: { u1: ['c1'] }, // u1 sees only c1
      att_secret: { u1: [] }, // u1 sees no secrets
    },
  };

  it('constrains the query to only visible parents (single parent_object → bare clause)', async () => {
    const { mw } = install(dataset);
    const { where, ran } = await runRead(mw, {});
    expect(ran).toBe(true);
    // u1 sees att_case/c1 only; att_secret none → dropped.
    expect(where).toEqual({ parent_object: 'att_case', parent_id: { $in: ['c1'] } });
  });

  it('emits a $or across multiple visible parent objects', async () => {
    const { mw } = install({
      attachments: [
        { id: 'a1', parent_object: 'att_case', parent_id: 'c1' },
        { id: 'a2', parent_object: 'att_todo', parent_id: 't1' },
      ],
      visible: { att_case: { u1: ['c1'] }, att_todo: { u1: ['t1'] } },
    });
    const { where } = await runRead(mw, {});
    expect(where).toEqual({
      $or: [
        { parent_object: 'att_case', parent_id: { $in: ['c1'] } },
        { parent_object: 'att_todo', parent_id: { $in: ['t1'] } },
      ],
    });
  });

  it('denies all when no candidate parent is visible', async () => {
    const { mw } = install({
      attachments: [{ id: 'a3', parent_object: 'att_secret', parent_id: 's1' }],
      visible: { att_secret: { u1: [] } },
    });
    const { where } = await runRead(mw, {});
    expect(where).toEqual({ id: '__attachment_parent_denied__' });
  });

  it('ANDs the visibility filter onto an existing where (does not clobber it)', async () => {
    // The pre-scan honors the caller's where, so the candidate rows must
    // carry the filtered field for this fake to surface them.
    const { mw } = install({
      attachments: [
        { id: 'a1', parent_object: 'att_case', parent_id: 'c1', mime_type: 'application/pdf' } as any,
        { id: 'a2', parent_object: 'att_case', parent_id: 'c2', mime_type: 'text/plain' } as any,
      ],
      visible: { att_case: { u1: ['c1', 'c2'] } },
    });
    const existing = { mime_type: 'application/pdf' };
    const { where } = await runRead(mw, { ast: { object: 'sys_attachment', where: existing } });
    // Only a1 matched the pre-scan (mime_type), and its parent c1 is visible.
    expect(where).toEqual({
      $and: [existing, { parent_object: 'att_case', parent_id: { $in: ['c1'] } }],
    });
  });

  it('filters count() identically (list total cannot leak the unfiltered count)', async () => {
    const { mw } = install(dataset);
    const { where } = await runRead(mw, { operation: 'count' });
    expect(where).toEqual({ parent_object: 'att_case', parent_id: { $in: ['c1'] } });
  });

  it('bypasses system context and context-less reads (internal calls)', async () => {
    const { mw, calls } = install(dataset);
    const sys = await runRead(mw, { context: { isSystem: true } as any });
    expect(sys.where).toBeUndefined();
    const anon = await runRead(mw, { context: undefined });
    expect(anon.where).toBeUndefined();
    // no parent probes were issued for the bypassed reads
    expect(calls.parentFinds).toHaveLength(0);
  });

  it('does not touch write operations', async () => {
    const { mw } = install(dataset);
    const { where } = await runRead(mw, { operation: 'delete', ast: { object: 'sys_attachment', where: { id: 'a1' } } });
    expect(where).toEqual({ id: 'a1' }); // unchanged
  });

  it('leaves an already-empty result set alone (no candidates → no filter)', async () => {
    const { mw } = install({ attachments: [], visible: {} });
    const { where } = await runRead(mw, {});
    expect(where).toBeUndefined();
  });

  it('ignores self-referential (parent_object=sys_attachment) rows — prevents probe re-entry', async () => {
    const { mw, calls } = install({
      attachments: [{ id: 'a1', parent_object: 'sys_attachment', parent_id: 'a0' }],
      visible: {},
    });
    const { where } = await runRead(mw, {});
    // only a self-ref candidate → nothing to grant → deny all, and NO parent
    // probe was issued against sys_attachment.
    expect(where).toEqual({ id: '__attachment_parent_denied__' });
    expect(calls.parentFinds).toHaveLength(0);
  });
});
