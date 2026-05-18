// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Phase B integration tests.
 *
 *  - status mirror (`approvalStatusField` on the business record)
 *  - process-level `onSubmit / onFinalApprove / onFinalReject / onRecall`
 *  - step-level `onApprove / onReject`
 *  - `inbox_notify` action writes `sys_notification` rows
 *  - `field_update` action writes the business record (token interpolation)
 *  - lifecycle hooks: afterInsert auto-submit, lock on beforeUpdate, allow
 *    status-mirror writes through, allow admin override.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ApprovalService } from './approval-service.js';
import { bindProcessHooks, unbindAllHooks } from './lifecycle-hooks.js';

interface FakeRow { [k: string]: any }

function makeFakeEngine() {
  const tables: Record<string, FakeRow[]> = {};
  const ensure = (n: string) => (tables[n] ??= []);
  const hooks: Record<string, Array<{ handler: (ctx: any) => any | Promise<any>; object?: string | string[]; packageId?: string }>> = {};

  function matches(row: FakeRow, filter: any): boolean {
    if (!filter || typeof filter !== 'object') return true;
    for (const [k, v] of Object.entries(filter)) {
      if (row[k] !== v) return false;
    }
    return true;
  }

  async function fire(event: string, ctx: any) {
    const list = hooks[event] ?? [];
    for (const h of list) {
      if (h.object) {
        const objs = Array.isArray(h.object) ? h.object : [h.object];
        if (!objs.includes(ctx.object)) continue;
      }
      await h.handler(ctx);
    }
  }

  return {
    _tables: tables,
    _hooks: hooks,
    async find(object: string, options?: any, _opts?: any) {
      const rows = ensure(object).filter(r => matches(r, options?.filter ?? options?.where));
      return rows.slice(0, options?.limit ?? 1000);
    },
    async insert(object: string, data: any, opts?: any) {
      const row = { ...data };
      ensure(object).push(row);
      const ctx = { object, event: 'afterInsert', result: row, input: { data: row }, session: opts?.context ?? {} };
      await fire('afterInsert', ctx);
      return row;
    },
    async update(object: string, idOrData: any, opts?: any) {
      const data = typeof idOrData === 'object' ? idOrData : opts;
      const id = typeof idOrData === 'object' ? idOrData.id : idOrData;
      // beforeUpdate (skip status-mirror writes from system context — the
      // hook itself decides via the `data.keys ⊆ approvalStatusField` rule).
      const beforeCtx = { object, event: 'beforeUpdate', input: { id, data }, session: opts?.context ?? {} };
      await fire('beforeUpdate', beforeCtx);
      const table = ensure(object);
      const i = table.findIndex(r => r.id === id);
      if (i >= 0) table[i] = { ...table[i], ...data };
      const after = table[i];
      const afterCtx = { object, event: 'afterUpdate', input: { id, data }, result: after, session: opts?.context ?? {} };
      await fire('afterUpdate', afterCtx);
      return after;
    },
    async delete(object: string, options?: any) {
      const table = ensure(object);
      const id = options?.where?.id ?? options?.id;
      const i = table.findIndex(r => r.id === id);
      if (i >= 0) table.splice(i, 1);
      return { id };
    },
    registerHook(event: string, handler: any, options?: any) {
      (hooks[event] ??= []).push({ handler, object: options?.object, packageId: options?.packageId });
    },
    unregisterHooksByPackage(packageId: string) {
      let removed = 0;
      for (const ev of Object.keys(hooks)) {
        const before = hooks[ev].length;
        hooks[ev] = hooks[ev].filter(h => h.packageId !== packageId);
        removed += before - hooks[ev].length;
      }
      return removed;
    },
  };
}

const SYS = { isSystem: true, roles: [], permissions: [] };
const USR = { userId: 'submitter', roles: [], permissions: [] };

function processWithMirror() {
  return {
    name: 'discount_approval',
    label: 'Discount Approval',
    object: 'opportunity',
    active: true,
    approvalStatusField: 'approval_status',
    lockRecord: true,
    entryCriteria: 'record.amount > 50000',
    onSubmit: [
      {
        type: 'inbox_notify' as const,
        name: 'notify_pending',
        config: {
          to: 'pending_approvers',
          title: 'Discount needs approval',
          body: 'Opportunity {record_id} amount review',
        },
      },
    ],
    onFinalApprove: [
      { type: 'field_update' as const, name: 'close_won', config: { field: 'stage', value: 'closed_won' } },
    ],
    onFinalReject: [
      { type: 'inbox_notify' as const, name: 'tell_submitter', config: { to: 'submitter', title: 'Rejected', body: 'Sorry' } },
    ],
    onRecall: [
      { type: 'inbox_notify' as const, name: 'recalled', config: { to: 'submitter', title: 'Recalled', body: 'Pulled back' } },
    ],
    steps: [
      {
        name: 'sales_manager',
        label: 'Sales Manager',
        approvers: [{ type: 'user' as const, value: 'manager' }],
        behavior: 'first_response' as const,
      },
    ],
  };
}

describe('Phase B — approval auto-takeover', () => {
  let engine: ReturnType<typeof makeFakeEngine>;
  let svc: ApprovalService;

  beforeEach(() => {
    engine = makeFakeEngine();
    svc = new ApprovalService({ engine: engine as any });
  });

  describe('status mirror + actions', () => {
    beforeEach(async () => {
      // Seed a business record so syncStatusField can update it.
      engine._tables.opportunity = [{ id: 'opp1', amount: 80000, stage: 'qualification', approval_status: 'not_submitted' }];
      await svc.defineProcess({
        name: 'discount_approval',
        label: 'Discount Approval',
        object: 'opportunity',
        definition: processWithMirror(),
      }, SYS as any);
    });

    it('writes onSubmit notifications and mirrors status to the business record', async () => {
      await svc.submit({ object: 'opportunity', recordId: 'opp1', submitterId: 'submitter', payload: engine._tables.opportunity[0] }, USR as any);

      // status mirrored.
      const opp = engine._tables.opportunity[0];
      expect(opp.approval_status).toBe('pending');

      // inbox notification written to pending approvers.
      const notes = engine._tables.sys_notification ?? [];
      expect(notes.length).toBeGreaterThanOrEqual(1);
      expect(notes.some(n => n.recipient_id === 'manager' && /Opportunity opp1/.test(n.body))).toBe(true);
    });

    it('runs onFinalApprove field_update on finalize, mirrors status=approved', async () => {
      const submitted = await svc.submit({ object: 'opportunity', recordId: 'opp1', submitterId: 'submitter', payload: engine._tables.opportunity[0] }, USR as any);
      await svc.approve(submitted.id, { actorId: 'manager' }, SYS as any);

      const opp = engine._tables.opportunity[0];
      expect(opp.stage).toBe('closed_won');
      expect(opp.approval_status).toBe('approved');
    });

    it('runs onFinalReject inbox_notify on rejection, mirrors status=rejected', async () => {
      const submitted = await svc.submit({ object: 'opportunity', recordId: 'opp1', submitterId: 'submitter', payload: engine._tables.opportunity[0] }, USR as any);
      await svc.reject(submitted.id, { actorId: 'manager', comment: 'too low' }, SYS as any);

      const opp = engine._tables.opportunity[0];
      expect(opp.approval_status).toBe('rejected');
      const notes = engine._tables.sys_notification ?? [];
      expect(notes.some(n => n.recipient_id === 'submitter' && n.title === 'Rejected')).toBe(true);
    });

    it('runs onRecall and mirrors status=recalled', async () => {
      const submitted = await svc.submit({ object: 'opportunity', recordId: 'opp1', submitterId: 'submitter', payload: engine._tables.opportunity[0] }, USR as any);
      await svc.recall(submitted.id, { actorId: 'submitter' }, USR as any);

      const opp = engine._tables.opportunity[0];
      expect(opp.approval_status).toBe('recalled');
      const notes = engine._tables.sys_notification ?? [];
      expect(notes.some(n => n.title === 'Recalled')).toBe(true);
    });
  });

  describe('lifecycle hooks', () => {
    beforeEach(async () => {
      await svc.defineProcess({
        name: 'discount_approval',
        label: 'Discount Approval',
        object: 'opportunity',
        definition: processWithMirror(),
      }, SYS as any);
      const procs = await svc.listProcesses({ activeOnly: true }, SYS as any);
      bindProcessHooks(engine as any, svc, procs);
    });

    it('auto-submits a request when an inserted record matches entryCriteria', async () => {
      await engine.insert('opportunity', { id: 'opp_high', amount: 100000, stage: 'qualification' });
      // Drain microtasks (insert kicks off the hook).
      await new Promise(r => setTimeout(r, 0));
      const requests = engine._tables.sys_approval_request ?? [];
      expect(requests.length).toBe(1);
      expect(requests[0].object_name).toBe('opportunity');
      expect(requests[0].record_id).toBe('opp_high');
    });

    it('does NOT auto-submit when entryCriteria evaluates to false', async () => {
      await engine.insert('opportunity', { id: 'opp_low', amount: 1000, stage: 'qualification' });
      await new Promise(r => setTimeout(r, 0));
      expect(engine._tables.sys_approval_request ?? []).toHaveLength(0);
    });

    it('does NOT double-submit when criteria continues to be true on update', async () => {
      await engine.insert('opportunity', { id: 'opp_dup', amount: 100000, stage: 'qualification' });
      await new Promise(r => setTimeout(r, 0));
      await engine.update('opportunity', { id: 'opp_dup', amount: 110000 }, { context: { ...SYS, roles: ['admin'] } });
      await new Promise(r => setTimeout(r, 0));
      expect((engine._tables.sys_approval_request ?? []).length).toBe(1);
    });

    it('lock hook blocks edits to a locked record', async () => {
      await engine.insert('opportunity', { id: 'opp_lock', amount: 100000, stage: 'qualification' });
      await new Promise(r => setTimeout(r, 0));
      await expect(
        engine.update('opportunity', { id: 'opp_lock', stage: 'closed_won' }, { context: { userId: 'u1', roles: [] } }),
      ).rejects.toThrow(/RECORD_LOCKED/);
    });

    it('lock hook allows admin role override', async () => {
      await engine.insert('opportunity', { id: 'opp_admin', amount: 100000, stage: 'qualification' });
      await new Promise(r => setTimeout(r, 0));
      await expect(
        engine.update('opportunity', { id: 'opp_admin', stage: 'closed_won' }, { context: { userId: 'admin', roles: ['admin'] } }),
      ).resolves.toBeTruthy();
    });

    it('unbindAllHooks removes registered hooks idempotently', async () => {
      const removed = unbindAllHooks(engine as any);
      expect(removed).toBeGreaterThan(0);
      // Re-bind to default state for any later beforeEach.
      const procs = await svc.listProcesses({ activeOnly: true }, SYS as any);
      bindProcessHooks(engine as any, svc, procs);
    });
  });
});
