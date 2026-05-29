// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, expect, it, vi } from 'vitest';
import type { IDataEngine } from '@objectstack/spec/contracts';
import { ToolRegistry } from '../tools/tool-registry.js';
import { registerDataTools } from '../tools/data-tools.js';

/**
 * Field-existence guard tests.
 *
 * The Data Assistant agent had a bias to hallucinate generic fields
 * like `status` / `is_active` / `deleted_at` in `where` clauses
 * (anchored on tool-description examples). The guard turns that into
 * a structured error pointing the LLM at describe_object, instead of
 * a silently-empty result set.
 */
describe('data-tools field-existence guard', () => {
  function buildRegistry(opts: {
    fields: string[];
    objectName?: string;
  }): { registry: ToolRegistry; findSpy: ReturnType<typeof vi.fn>; aggSpy: ReturnType<typeof vi.fn> } {
    const objectName = opts.objectName ?? 'crm_opportunity';
    const findSpy = vi.fn(async () => []);
    const findOneSpy = vi.fn(async () => null);
    const aggSpy = vi.fn(async () => []);
    const engine = {
      find: findSpy,
      findOne: findOneSpy,
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
      aggregate: aggSpy,
    } as unknown as IDataEngine;

    const metadataService = {
      getObject: vi.fn(async (name: string) => {
        if (name !== objectName) return undefined;
        const f: Record<string, { type: string }> = {};
        for (const k of opts.fields) f[k] = { type: 'text' };
        return { name, fields: f };
      }),
    };

    const registry = new ToolRegistry();
    registerDataTools(registry, {
      dataEngine: engine,
      metadataService: metadataService as never,
    });
    return { registry, findSpy, aggSpy };
  }

  async function runTool(registry: ToolRegistry, name: string, input: unknown): Promise<string> {
    const result = await registry.execute(
      { type: 'tool-call', toolCallId: 'tc', toolName: name, input } as never,
      { actor: { id: 'u', name: 'u', roles: [] }, signal: new AbortController().signal },
    );
    return (result.output as { value: string }).value;
  }

  it('rejects unknown where-clause fields and points at describe_object', async () => {
    const { registry, findSpy } = buildRegistry({
      fields: ['id', 'name', 'amount', 'stage'],
    });
    const out = await runTool(registry, 'query_records', {
      objectName: 'crm_opportunity',
      where: { status: 'active' },
    });
    expect(findSpy).not.toHaveBeenCalled();
    const parsed = JSON.parse(out);
    expect(parsed.error).toContain('Unknown field');
    expect(parsed.unknownFields).toEqual(['status']);
    expect(parsed.hint).toContain('describe_object');
    expect(parsed.availableFields).toEqual(expect.arrayContaining(['stage', 'amount']));
  });

  it('allows valid where + recurses into $and / $or conjunctions', async () => {
    const { registry, findSpy } = buildRegistry({
      fields: ['id', 'name', 'amount', 'stage'],
    });
    await runTool(registry, 'query_records', {
      objectName: 'crm_opportunity',
      where: {
        $and: [
          { stage: 'qualified' },
          { $or: [{ amount: { $gte: 1000 } }, { name: { $like: '%enterprise%' } }] },
        ],
      },
      fields: ['id', 'name', 'amount'],
    });
    expect(findSpy).toHaveBeenCalledTimes(1);
  });

  it('rejects unknown field inside an $or branch', async () => {
    const { registry, findSpy } = buildRegistry({
      fields: ['id', 'name', 'amount'],
    });
    const out = await runTool(registry, 'query_records', {
      objectName: 'crm_opportunity',
      where: { $or: [{ amount: 100 }, { is_active: true }] },
    });
    expect(findSpy).not.toHaveBeenCalled();
    expect(JSON.parse(out).unknownFields).toEqual(['is_active']);
  });

  it('rejects unknown projection / orderBy fields on query_records', async () => {
    const { registry, findSpy } = buildRegistry({
      fields: ['id', 'name'],
    });
    const out = await runTool(registry, 'query_records', {
      objectName: 'crm_opportunity',
      fields: ['id', 'phantom'],
      orderBy: [{ field: 'created_at', order: 'desc' }],
    });
    expect(findSpy).not.toHaveBeenCalled();
    const unknown = JSON.parse(out).unknownFields as string[];
    expect(unknown.sort()).toEqual(['created_at', 'phantom']);
  });

  it('rejects unknown groupBy / aggregation field on aggregate_data', async () => {
    const { registry, aggSpy } = buildRegistry({
      fields: ['id', 'amount', 'stage'],
    });
    const out = await runTool(registry, 'aggregate_data', {
      objectName: 'crm_opportunity',
      groupBy: ['ghost_dim'],
      aggregations: [{ function: 'sum', field: 'revenue', alias: 'total' }],
    });
    expect(aggSpy).not.toHaveBeenCalled();
    const unknown = JSON.parse(out).unknownFields as string[];
    expect(unknown.sort()).toEqual(['ghost_dim', 'revenue']);
  });

  it('allows count() without a field even when other fields are unknown elsewhere', async () => {
    const { registry, aggSpy } = buildRegistry({
      fields: ['id', 'stage'],
    });
    await runTool(registry, 'aggregate_data', {
      objectName: 'crm_opportunity',
      aggregations: [{ function: 'count', alias: 'n' }],
    });
    expect(aggSpy).toHaveBeenCalledTimes(1);
  });

  it('skips validation when metadata service is not wired (legacy callers)', async () => {
    const findSpy = vi.fn(async () => []);
    const engine = {
      find: findSpy,
      findOne: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
      aggregate: vi.fn(),
    } as unknown as IDataEngine;

    const registry = new ToolRegistry();
    registerDataTools(registry, { dataEngine: engine }); // no metadataService
    await registry.execute(
      {
        type: 'tool-call',
        toolCallId: 'tc',
        toolName: 'query_records',
        input: { objectName: 'crm_opportunity', where: { status: 'active' } },
      } as never,
      { actor: { id: 'u', name: 'u', roles: [] }, signal: new AbortController().signal },
    );
    expect(findSpy).toHaveBeenCalledTimes(1);
  });

  it('falls back to protocol.getMetaItems when metadataService is absent', async () => {
    const findSpy = vi.fn(async () => []);
    const engine = {
      find: findSpy,
      findOne: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
      aggregate: vi.fn(),
    } as unknown as IDataEngine;

    const protocol = {
      getMetaItems: vi.fn(async () => [
        { name: 'crm_opportunity', fields: { id: {}, name: {}, amount: {} } },
      ]),
    };

    const registry = new ToolRegistry();
    registerDataTools(registry, {
      dataEngine: engine,
      protocol: protocol as never,
    });
    const result = await registry.execute(
      {
        type: 'tool-call',
        toolCallId: 'tc',
        toolName: 'query_records',
        input: { objectName: 'crm_opportunity', where: { status: 'active' } },
      } as never,
      { actor: { id: 'u', name: 'u', roles: [] }, signal: new AbortController().signal },
    );
    expect(findSpy).not.toHaveBeenCalled();
    expect(JSON.parse((result.output as { value: string }).value).unknownFields).toEqual(['status']);
  });
});
