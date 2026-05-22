// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect } from 'vitest';
import { InMemoryRepository } from '../src/in-memory-repository.js';
import { runRepositoryContractTests } from '../src/contract-suite.js';
import { hashSpec } from '../src/canonicalize.js';

runRepositoryContractTests('InMemoryRepository', () => new InMemoryRepository());

describe('InMemoryRepository — implementation-specific', () => {
  it('uses injected clock for authoredAt timestamps', async () => {
    const fixed = new Date('2025-01-15T00:00:00.000Z');
    const repo = new InMemoryRepository({ now: () => fixed });
    const ref = {
      org: 'system',
      type: 'view' as const,
      name: 'a',
    };
    const res = await repo.put(ref, { x: 1 }, { parentVersion: null, actor: 't' });
    expect(res.item.authoredAt).toBe('2025-01-15T00:00:00.000Z');
  });

  it('canonical hash is independent of property insertion order', async () => {
    const repo = new InMemoryRepository();
    const ref = {
      org: 'system',
      type: 'view' as const,
      name: 'a',
    };
    const h1 = hashSpec({ a: 1, b: 2 });
    const h2 = hashSpec({ b: 2, a: 1 });
    expect(h1).toBe(h2);
    const r = await repo.put(ref, { b: 2, a: 1 }, { parentVersion: null, actor: 't' });
    expect(r.version).toBe(h1);
  });

  it('returns deep copies — caller mutations do not affect store', async () => {
    const repo = new InMemoryRepository();
    const ref = {
      org: 'system',
      type: 'view' as const,
      name: 'a',
    };
    const spec = { items: [{ id: 1 }] };
    await repo.put(ref, spec, { parentVersion: null, actor: 't' });
    spec.items[0]!.id = 999;
    const got = await repo.get(ref);
    expect((got!.body as { items: Array<{ id: number }> }).items[0]!.id).toBe(1);
  });
});
