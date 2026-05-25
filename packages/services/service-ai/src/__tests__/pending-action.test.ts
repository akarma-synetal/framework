// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.
//
// Unit tests for the HITL pending-action queue exposed by AIService.
// Uses an in-memory IDataEngine mock to exercise propose → approve → reject
// without spinning up the full ObjectQL stack.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AIService } from '../ai-service.js';

interface Row {
  id: string;
  status: string;
  [k: string]: unknown;
}

class MemoryEngine {
  rows: Row[] = [];
  insert = vi.fn(async (_obj: string, data: Row) => {
    this.rows.push({ ...data });
    return { ...data };
  });
  find = vi.fn(async (_obj: string, q: any) => {
    const rows = this.rows.filter((r) => {
      if (q?.where?.id) return r.id === q.where.id;
      if (q?.where?.status) return r.status === q.where.status;
      return true;
    });
    return rows;
  });
  update = vi.fn(async (_obj: string, data: any, opts: any) => {
    const id = opts?.where?.id;
    const idx = this.rows.findIndex((r) => r.id === id);
    if (idx >= 0) this.rows[idx] = { ...this.rows[idx], ...data };
    return this.rows[idx];
  });
}

const silentLogger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
} as any;

describe('AIService — HITL pending-action queue', () => {
  let engine: MemoryEngine;
  let service: AIService;

  beforeEach(() => {
    engine = new MemoryEngine();
    service = new AIService({ logger: silentLogger, dataEngine: engine as any });
  });

  it('proposePendingAction inserts a row with status="pending"', async () => {
    const { id } = await service.proposePendingAction!({
      objectName: 'task',
      actionName: 'delete_task',
      toolName: 'action_delete_task',
      toolInput: { recordId: 'rec_1' },
      proposedBy: 'ai_agent',
    });

    expect(id).toBeTruthy();
    expect(engine.insert).toHaveBeenCalledTimes(1);
    expect(engine.rows[0].id).toBe(id);
    expect(engine.rows[0].status).toBe('pending');
    expect(engine.rows[0].tool_name).toBe('action_delete_task');
    expect(engine.rows[0].object_name).toBe('task');
    expect(engine.rows[0].proposed_by).toBe('ai_agent');
  });

  it('approvePendingAction calls registered dispatcher and marks executed', async () => {
    const dispatch = vi.fn(async (_input: any) => ({ ok: true, result: { deleted: true } }));
    service.registerPendingActionDispatcher!('action_delete_task', dispatch);

    const { id } = await service.proposePendingAction!({
      objectName: 'task',
      actionName: 'delete_task',
      toolName: 'action_delete_task',
      toolInput: { recordId: 'rec_1' },
    });

    const outcome = await service.approvePendingAction!(id, 'alice');
    expect(outcome.status).toBe('executed');
    expect(dispatch).toHaveBeenCalledWith({ recordId: 'rec_1' });
    expect(engine.rows[0].status).toBe('executed');
    expect(engine.rows[0].decided_by).toBe('alice');
    expect(engine.rows[0].decided_at).toBeTruthy();
  });

  it('approvePendingAction marks failed when dispatcher throws', async () => {
    const dispatch = vi.fn(async () => {
      throw new Error('record gone');
    });
    service.registerPendingActionDispatcher!('action_delete_task', dispatch);

    const { id } = await service.proposePendingAction!({
      objectName: 'task',
      actionName: 'delete_task',
      toolName: 'action_delete_task',
      toolInput: {},
    });

    const outcome = await service.approvePendingAction!(id, 'alice');
    expect(outcome.status).toBe('failed');
    expect(outcome.error).toMatch(/record gone/);
    expect(engine.rows[0].status).toBe('failed');
  });

  it('approvePendingAction rejects when no dispatcher is registered', async () => {
    const { id } = await service.proposePendingAction!({
      objectName: 'task',
      actionName: 'orphan_action',
      toolName: 'action_orphan_action',
      toolInput: {},
    });

    await expect(service.approvePendingAction!(id, 'alice')).rejects.toThrow(/dispatcher/i);
  });

  it('approvePendingAction rejects when row is not pending', async () => {
    const dispatch = vi.fn(async () => ({ ok: true }));
    service.registerPendingActionDispatcher!('action_delete_task', dispatch);
    const { id } = await service.proposePendingAction!({
      objectName: 'task',
      actionName: 'delete_task',
      toolName: 'action_delete_task',
      toolInput: {},
    });

    await service.approvePendingAction!(id, 'alice');
    // Second approve should fail (already executed).
    await expect(service.approvePendingAction!(id, 'bob')).rejects.toThrow(/not pending|already/i);
  });

  it('rejectPendingAction marks row rejected with reason', async () => {
    const { id } = await service.proposePendingAction!({
      objectName: 'task',
      actionName: 'delete_task',
      toolName: 'action_delete_task',
      toolInput: {},
    });
    await service.rejectPendingAction!(id, 'alice', 'too destructive');
    expect(engine.rows[0].status).toBe('rejected');
    expect(engine.rows[0].rejection_reason).toBe('too destructive');
    expect(engine.rows[0].decided_by).toBe('alice');
  });

  it('listPendingActions returns rows (filterable by status)', async () => {
    await service.proposePendingAction!({
      objectName: 'task',
      actionName: 'delete_task',
      toolName: 'action_delete_task',
      toolInput: {},
    });
    const all = await service.listPendingActions!({});
    expect(all).toHaveLength(1);
    const pending = await service.listPendingActions!({ status: 'pending' });
    expect(pending).toHaveLength(1);
    const rejected = await service.listPendingActions!({ status: 'rejected' });
    expect(rejected).toHaveLength(0);
  });

  it('throws clearly when dataEngine is not wired', async () => {
    const noEngine = new AIService({ logger: silentLogger });
    await expect(
      noEngine.proposePendingAction!({
        objectName: 'task',
        actionName: 'x',
        toolName: 'action_x',
        toolInput: {},
      }),
    ).rejects.toThrow(/dataEngine|engine/i);
  });
});
