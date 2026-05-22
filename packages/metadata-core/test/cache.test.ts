// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import { InMemoryRepository } from '../src/in-memory-repository.js';
import { MetadataCache } from '../src/cache.js';
import type { MetaRef } from '../src/types.js';

const baseRef = (name: string, type: 'view' | 'object' = 'view'): MetaRef => ({
  org: 'system',
  project: 'test',
  branch: 'main',
  type,
  name,
});

describe('MetadataCache', () => {
  let repo: InMemoryRepository;
  let cache: MetadataCache;

  beforeEach(() => {
    repo = new InMemoryRepository();
    cache = new MetadataCache(repo, { maxEntries: 100, maxBytes: 1024 * 1024 });
    cache.start();
  });

  afterEach(async () => {
    await cache.close();
  });

  it('returns null for missing items (negative cache)', async () => {
    const ref = baseRef('absent');
    expect(await cache.get(ref)).toBeNull();
    const stats1 = cache.getStats();
    // Second read should hit the negative cache, not the repo.
    expect(await cache.get(ref)).toBeNull();
    const stats2 = cache.getStats();
    expect(stats2.misses).toBe(stats1.misses);
    expect(stats2.hits).toBeGreaterThan(stats1.hits);
  });

  it('caches positive reads and serves them on subsequent calls', async () => {
    const ref = baseRef('alpha');
    await repo.put(ref, { label: 'A' }, { parentVersion: null, actor: 't' });
    const first = await cache.get(ref);
    expect(first?.body).toEqual({ label: 'A' });
    expect(cache.getStats().misses).toBe(1);
    const second = await cache.get(ref);
    expect(second?.body).toEqual({ label: 'A' });
    expect(cache.getStats().misses).toBe(1);
    expect(cache.getStats().hits).toBeGreaterThan(0);
  });

  it('returns deep copies — caller mutations cannot corrupt the cache', async () => {
    const ref = baseRef('safe');
    await repo.put(ref, { items: [1, 2, 3] }, { parentVersion: null, actor: 't' });
    const a = await cache.get(ref);
    (a!.body as { items: number[] }).items.push(999);
    const b = await cache.get(ref);
    expect((b!.body as { items: number[] }).items).toEqual([1, 2, 3]);
  });

  it('invalidates cache on repository write events', async () => {
    const ref = baseRef('mutable');
    const a = await repo.put(ref, { label: 'first' }, { parentVersion: null, actor: 't' });
    expect((await cache.get(ref))?.body).toEqual({ label: 'first' });

    // Update through the repo; cache must observe the change.
    await repo.put(ref, { label: 'second' }, { parentVersion: a.version, actor: 't' });
    await flushEvents();
    expect((await cache.get(ref))?.body).toEqual({ label: 'second' });
    expect(cache.getStats().invalidations).toBeGreaterThan(0);
  });

  it('invalidates negative cache when a previously-missing item is created', async () => {
    const ref = baseRef('appears');
    expect(await cache.get(ref)).toBeNull();
    await repo.put(ref, { label: 'now here' }, { parentVersion: null, actor: 't' });
    await flushEvents();
    const got = await cache.get(ref);
    expect(got?.body).toEqual({ label: 'now here' });
  });

  it('invalidates on delete (tombstone)', async () => {
    const ref = baseRef('doomed');
    const a = await repo.put(ref, { label: 'goodbye' }, { parentVersion: null, actor: 't' });
    expect((await cache.get(ref))?.body).toEqual({ label: 'goodbye' });
    await repo.delete(ref, { parentVersion: a.version, actor: 't' });
    await flushEvents();
    expect(await cache.get(ref)).toBeNull();
  });

  it('coalesces concurrent reads for the same key', async () => {
    let calls = 0;
    const slowRepo: InMemoryRepository = Object.create(repo);
    slowRepo.get = async (r: MetaRef) => {
      calls += 1;
      await new Promise((resolve) => setTimeout(resolve, 10));
      return InMemoryRepository.prototype.get.call(repo, r);
    };
    const c = new MetadataCache(slowRepo, { maxEntries: 10 });
    c.start();
    try {
      const ref = baseRef('hot');
      await repo.put(ref, { v: 1 }, { parentVersion: null, actor: 't' });
      const results = await Promise.all([
        c.get(ref), c.get(ref), c.get(ref), c.get(ref), c.get(ref),
      ]);
      expect(results.every((r) => r?.body && (r.body as { v: number }).v === 1)).toBe(true);
      expect(calls).toBe(1);
      expect(c.getStats().coalesced).toBe(4);
    } finally {
      await c.close();
    }
  });

  it('evicts LRU entries when maxEntries is exceeded', async () => {
    const small = new MetadataCache(repo, { maxEntries: 3 });
    small.start();
    try {
      for (let i = 0; i < 5; i++) {
        const ref = baseRef(`item_${i}`);
        await repo.put(ref, { i }, { parentVersion: null, actor: 't' });
        await small.get(ref);
      }
      expect(small.getStats().entries).toBeLessThanOrEqual(3);
    } finally {
      await small.close();
    }
  });

  it('evicts when maxBytes is exceeded', async () => {
    const tiny = new MetadataCache(repo, { maxEntries: 1000, maxBytes: 2000 });
    tiny.start();
    try {
      // Each body is ~200 bytes JSON; once we put more than ~10 of them
      // we should be over the byte limit (estimated at 2× JSON length).
      const big = 'x'.repeat(100);
      for (let i = 0; i < 20; i++) {
        const ref = baseRef(`big_${i}`);
        await repo.put(ref, { data: big, i }, { parentVersion: null, actor: 't' });
        await tiny.get(ref);
      }
      const stats = tiny.getStats();
      expect(stats.bytes).toBeLessThanOrEqual(2000);
      expect(stats.entries).toBeLessThan(20);
    } finally {
      await tiny.close();
    }
  });

  it('LRU touch on get keeps frequently-read entries hot', async () => {
    const small = new MetadataCache(repo, { maxEntries: 3 });
    small.start();
    try {
      const refs = ['a', 'b', 'c'].map((n) => baseRef(n));
      for (const ref of refs) {
        await repo.put(ref, { n: ref.name }, { parentVersion: null, actor: 't' });
        await small.get(ref);
      }
      // Touch 'a' so it becomes most-recent.
      await small.get(refs[0]!);
      // Add 'd' — should evict 'b' (now least-recent).
      const d = baseRef('d');
      await repo.put(d, { n: 'd' }, { parentVersion: null, actor: 't' });
      await small.get(d);

      // 'a' still cached → hit; 'b' evicted → miss.
      const missesBefore = small.getStats().misses;
      await small.get(refs[0]!); // hit
      expect(small.getStats().misses).toBe(missesBefore);
      await small.get(refs[1]!); // miss
      expect(small.getStats().misses).toBe(missesBefore + 1);
    } finally {
      await small.close();
    }
  });

  it('clear() drops everything and forces refetch', async () => {
    const ref = baseRef('item');
    await repo.put(ref, { v: 1 }, { parentVersion: null, actor: 't' });
    await cache.get(ref);
    cache.clear();
    expect(cache.getStats().entries).toBe(0);
    const missesBefore = cache.getStats().misses;
    await cache.get(ref);
    expect(cache.getStats().misses).toBe(missesBefore + 1);
  });

  it('respects watchFilter — events outside the filter do not invalidate', async () => {
    const objOnly = new MetadataCache(repo, {
      maxEntries: 100,
      watchFilter: { type: 'object' },
    });
    objOnly.start();
    try {
      const viewRef = baseRef('v1', 'view');
      const a = await repo.put(viewRef, { label: 'original' }, { parentVersion: null, actor: 't' });
      await objOnly.get(viewRef);
      await repo.put(viewRef, { label: 'updated' }, { parentVersion: a.version, actor: 't' });
      await flushEvents();
      // Since the cache only watches 'object' events, the view update is
      // NOT invalidated — the cache returns the stale value.
      const got = await objOnly.get(viewRef);
      expect((got!.body as { label: string }).label).toBe('original');
    } finally {
      await objOnly.close();
    }
  });
});

describe('MetadataCache — property-based coherence', () => {
  it('cache eventually converges to repository state under concurrent ops', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            name: fc.constantFrom('a', 'b', 'c'),
            value: fc.integer({ min: 0, max: 100 }),
          }),
          { minLength: 1, maxLength: 20 },
        ),
        async (ops) => {
          const repo = new InMemoryRepository();
          const cache = new MetadataCache(repo, { maxEntries: 10 });
          cache.start();
          try {
            // Apply ops sequentially; track expected state.
            const expected = new Map<string, { value: number }>();
            const parents = new Map<string, string | null>();
            for (const op of ops) {
              const ref = baseRef(op.name);
              const parent = parents.get(op.name) ?? null;
              const res = await repo.put(
                ref,
                { value: op.value },
                { parentVersion: parent, actor: 't' },
              );
              expected.set(op.name, { value: op.value });
              parents.set(op.name, res.version);
            }
            // Allow event propagation.
            await flushEvents();
            // Now cache.get must match expected for every name.
            for (const [name, body] of expected) {
              const got = await cache.get(baseRef(name));
              if (!got || JSON.stringify(got.body) !== JSON.stringify(body)) {
                return false;
              }
            }
            return true;
          } finally {
            await cache.close();
          }
        },
      ),
      { numRuns: 30 },
    );
  });
});

/** Allow the watch loop and any queued microtasks to run. */
async function flushEvents(): Promise<void> {
  // Two macrotask hops are sufficient to drain the watch loop's
  // pending iterator.next() → applyEvent → invalidate chain.
  await new Promise((resolve) => setTimeout(resolve, 5));
  await new Promise((resolve) => setTimeout(resolve, 5));
}
