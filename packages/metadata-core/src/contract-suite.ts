// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Parameterised Repository contract test suite. Every `MetadataRepository`
 * implementation MUST pass this suite. Reuse:
 *
 *     import { runRepositoryContractTests } from '@objectstack/metadata-core/test';
 *     runRepositoryContractTests('InMemory', () => new InMemoryRepository());
 *
 * The suite verifies the seven invariants from `repository.ts`:
 *
 *   1. Atomic put
 *   2. Monotonic seq per branch
 *   3. Optimistic locking (ConflictError)
 *   4. Canonical hashing (hash === hashSpec(body))
 *   5. Event ordering (monotonic seq, no gaps)
 *   6. Resumability (watch with `since` replays)
 *   7. Tombstones (delete event emitted, get returns null)
 */

import { describe, it, expect } from 'vitest';
import type { MetadataRepository } from './repository.js';
import type { MetaRef, MetadataEvent } from './types.js';
import { hashSpec } from './canonicalize.js';
import { ConflictError } from './errors.js';

export interface ContractSuiteOptions {
  /** If the implementation supports `version`-pinned reads, set true. */
  supportsVersionedReads?: boolean;
}

const refOf = (overrides: Partial<MetaRef> = {}): MetaRef => ({
  org: 'system',
  project: 'test',
  branch: 'main',
  type: 'view',
  name: 'sample_view',
  ...overrides,
});

const spec = (label: string) => ({ label, columns: ['a', 'b'] });

/** Drain at most `n` events from an async iterable with a timeout. */
async function take<T>(iter: AsyncIterable<T>, n: number, timeoutMs = 1000): Promise<T[]> {
  const out: T[] = [];
  const it = iter[Symbol.asyncIterator]();
  const deadline = Date.now() + timeoutMs;
  while (out.length < n) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) break;
    const result = await Promise.race([
      it.next(),
      new Promise<{ value: undefined; done: true }>((resolve) =>
        setTimeout(() => resolve({ value: undefined, done: true }), remaining),
      ),
    ]);
    if (result.done) break;
    out.push(result.value as T);
  }
  // Close the iterator so the repo subscriber is freed.
  await it.return?.(undefined);
  return out;
}

export function runRepositoryContractTests(
  label: string,
  factory: () => MetadataRepository | Promise<MetadataRepository>,
  opts: ContractSuiteOptions = {},
): void {
  describe(`MetadataRepository contract — ${label}`, () => {
    // ── 1. Atomic put + canonical hash ──────────────────────────────
    describe('put / get', () => {
      it('creates an item from null parent', async () => {
        const repo = await factory();
        const ref = refOf();
        const res = await repo.put(ref, spec('hello'), { parentVersion: null, actor: 'tester' });
        expect(res.version).toMatch(/^sha256:[0-9a-f]{64}$/);
        expect(res.version).toBe(hashSpec(spec('hello')));
        expect(res.seq).toBeGreaterThan(0);
        expect(res.item.parentHash).toBeNull();
        expect(res.item.authoredBy).toBe('tester');

        const got = await repo.get(ref);
        expect(got).not.toBeNull();
        expect(got!.hash).toBe(res.version);
        expect(got!.body).toEqual(spec('hello'));
      });

      it('round-trips successive updates with parent chaining', async () => {
        const repo = await factory();
        const ref = refOf();
        const a = await repo.put(ref, spec('one'), { parentVersion: null, actor: 't' });
        const b = await repo.put(ref, spec('two'), { parentVersion: a.version, actor: 't' });
        const c = await repo.put(ref, spec('three'), { parentVersion: b.version, actor: 't' });
        expect(b.item.parentHash).toBe(a.version);
        expect(c.item.parentHash).toBe(b.version);
        expect(c.seq).toBeGreaterThan(b.seq);
        expect(b.seq).toBeGreaterThan(a.seq);
      });

      it('canonical hash invariant: item.hash === hashSpec(item.body)', async () => {
        const repo = await factory();
        const ref = refOf();
        await repo.put(ref, { z: 1, a: 2, m: [3, 1, 2] }, { parentVersion: null, actor: 't' });
        const got = await repo.get(ref);
        expect(got!.hash).toBe(hashSpec(got!.body));
      });

      it('returns null for missing item', async () => {
        const repo = await factory();
        expect(await repo.get(refOf({ name: 'never_existed' }))).toBeNull();
      });

      it('no-op write with identical content returns current version', async () => {
        const repo = await factory();
        const ref = refOf();
        const a = await repo.put(ref, spec('same'), { parentVersion: null, actor: 't' });
        const b = await repo.put(ref, spec('same'), { parentVersion: a.version, actor: 't' });
        expect(b.version).toBe(a.version);
        expect(b.seq).toBe(a.seq);
      });
    });

    // ── 2 & 3. Optimistic locking + Monotonic seq ───────────────────
    describe('optimistic locking', () => {
      it('throws ConflictError when parentVersion mismatches', async () => {
        const repo = await factory();
        const ref = refOf();
        const a = await repo.put(ref, spec('v1'), { parentVersion: null, actor: 't' });
        await expect(
          repo.put(ref, spec('v2'), { parentVersion: null, actor: 't' }),
        ).rejects.toBeInstanceOf(ConflictError);
        await expect(
          repo.put(ref, spec('v2'), { parentVersion: 'sha256:deadbeef'.padEnd(71, '0'), actor: 't' }),
        ).rejects.toBeInstanceOf(ConflictError);
        // Sanity: correct parent succeeds.
        await expect(
          repo.put(ref, spec('v2'), { parentVersion: a.version, actor: 't' }),
        ).resolves.toMatchObject({ seq: expect.any(Number) });
      });

      it('throws ConflictError when creating over an existing item with null parent', async () => {
        const repo = await factory();
        const ref = refOf();
        await repo.put(ref, spec('a'), { parentVersion: null, actor: 't' });
        await expect(
          repo.put(ref, spec('b'), { parentVersion: null, actor: 't' }),
        ).rejects.toBeInstanceOf(ConflictError);
      });

      it('delete requires correct parentVersion', async () => {
        const repo = await factory();
        const ref = refOf();
        const a = await repo.put(ref, spec('a'), { parentVersion: null, actor: 't' });
        await expect(
          repo.delete(ref, { parentVersion: 'sha256:wrong'.padEnd(71, '0'), actor: 't' }),
        ).rejects.toBeInstanceOf(ConflictError);
        await repo.delete(ref, { parentVersion: a.version, actor: 't' });
      });
    });

    describe('monotonic seq per branch', () => {
      it('seq strictly increases within a branch', async () => {
        const repo = await factory();
        const ref = refOf();
        const a = await repo.put(ref, spec('1'), { parentVersion: null, actor: 't' });
        const b = await repo.put(ref, spec('2'), { parentVersion: a.version, actor: 't' });
        const c = await repo.put(refOf({ name: 'other' }), spec('o'), { parentVersion: null, actor: 't' });
        expect(b.seq).toBeGreaterThan(a.seq);
        expect(c.seq).toBeGreaterThan(b.seq);
      });

      it('different branches have independent sequences', async () => {
        const repo = await factory();
        const mainRef = refOf({ branch: 'main' });
        const devRef = refOf({ branch: 'dev' });
        const a = await repo.put(mainRef, spec('m1'), { parentVersion: null, actor: 't' });
        const b = await repo.put(devRef, spec('d1'), { parentVersion: null, actor: 't' });
        // Both can start at seq 1 (independent). The contract is only
        // strict monotonicity *within* a branch.
        const c = await repo.put(mainRef, spec('m2'), { parentVersion: a.version, actor: 't' });
        const d = await repo.put(devRef, spec('d2'), { parentVersion: b.version, actor: 't' });
        expect(c.seq).toBeGreaterThan(a.seq);
        expect(d.seq).toBeGreaterThan(b.seq);
      });
    });

    // ── 4. Tombstones ───────────────────────────────────────────────
    describe('delete / tombstones', () => {
      it('get returns null after delete; history retains lineage', async () => {
        const repo = await factory();
        const ref = refOf();
        const a = await repo.put(ref, spec('a'), { parentVersion: null, actor: 't' });
        await repo.delete(ref, { parentVersion: a.version, actor: 't' });
        expect(await repo.get(ref)).toBeNull();
        const hist: MetadataEvent[] = [];
        for await (const evt of repo.history(ref)) hist.push(evt);
        expect(hist.map((e) => e.op)).toEqual(['create', 'delete']);
        expect(hist[1]?.parentHash).toBe(a.version);
        expect(hist[1]?.hash).toBeNull();
      });

      it('can recreate after delete with null parent', async () => {
        const repo = await factory();
        const ref = refOf();
        const a = await repo.put(ref, spec('a'), { parentVersion: null, actor: 't' });
        await repo.delete(ref, { parentVersion: a.version, actor: 't' });
        const b = await repo.put(ref, spec('a-redux'), { parentVersion: null, actor: 't' });
        expect(b.item.parentHash).toBeNull();
      });
    });

    // ── 5. Event ordering & watch replay ────────────────────────────
    describe('watch / history', () => {
      it('history yields events in monotonic seq order', async () => {
        const repo = await factory();
        const ref = refOf();
        const a = await repo.put(ref, spec('1'), { parentVersion: null, actor: 't' });
        const b = await repo.put(ref, spec('2'), { parentVersion: a.version, actor: 't' });
        const c = await repo.put(ref, spec('3'), { parentVersion: b.version, actor: 't' });
        const evts: MetadataEvent[] = [];
        for await (const e of repo.history(ref)) evts.push(e);
        expect(evts.map((e) => e.seq)).toEqual([a.seq, b.seq, c.seq]);
        expect(evts.every((e, i) => i === 0 || e.seq > evts[i - 1]!.seq)).toBe(true);
      });

      it('watch(sinceSeq) replays subsequent events then goes live', async () => {
        const repo = await factory();
        const ref = refOf();
        const a = await repo.put(ref, spec('1'), { parentVersion: null, actor: 't' });
        const b = await repo.put(ref, spec('2'), { parentVersion: a.version, actor: 't' });

        // Start watching with `since = a.seq` — must replay b, then deliver a live event.
        const iter = repo.watch({ org: ref.org, project: ref.project, branch: ref.branch }, a.seq);
        const collected: MetadataEvent[] = [];
        const it = iter[Symbol.asyncIterator]();

        // First yield should be the replay of `b`.
        const first = await it.next();
        expect(first.done).toBe(false);
        collected.push(first.value as MetadataEvent);
        expect(collected[0]!.seq).toBe(b.seq);

        // Now trigger a live event and collect it.
        const livePromise = it.next();
        const c = await repo.put(ref, spec('3'), { parentVersion: b.version, actor: 't' });
        const live = await livePromise;
        expect(live.done).toBe(false);
        collected.push(live.value as MetadataEvent);
        expect(collected[1]!.seq).toBe(c.seq);

        await it.return?.(undefined);
      });

      it('watch filters by type and name', async () => {
        const repo = await factory();
        await repo.put(refOf({ name: 'a' }), spec('a'), { parentVersion: null, actor: 't' });
        await repo.put(refOf({ name: 'b' }), spec('b'), { parentVersion: null, actor: 't' });
        const events = await take(
          repo.watch({ org: 'system', project: 'test', branch: 'main', type: 'view', name: 'a' }),
          5,
          200,
        );
        expect(events.length).toBe(1);
        expect(events[0]!.ref.name).toBe('a');
      });
    });

    // ── list ────────────────────────────────────────────────────────
    describe('list', () => {
      it('returns headers (no body) for matching items', async () => {
        const repo = await factory();
        await repo.put(refOf({ name: 'alpha' }), spec('a'), { parentVersion: null, actor: 't' });
        await repo.put(refOf({ name: 'beta' }), spec('b'), { parentVersion: null, actor: 't' });
        await repo.put(refOf({ type: 'object', name: 'thing' }), spec('o'), {
          parentVersion: null,
          actor: 't',
        });
        const headers: unknown[] = [];
        for await (const h of repo.list({ type: 'view' })) headers.push(h);
        expect(headers.length).toBe(2);
        for (const h of headers) {
          expect((h as { body?: unknown }).body).toBeUndefined();
        }
      });

      it('limit clamps result size', async () => {
        const repo = await factory();
        for (let i = 0; i < 5; i++) {
          await repo.put(refOf({ name: `v_${i}` }), spec(`v${i}`), { parentVersion: null, actor: 't' });
        }
        const headers: unknown[] = [];
        for await (const h of repo.list({ type: 'view', limit: 3 })) headers.push(h);
        expect(headers.length).toBe(3);
      });
    });

    // ── Optional behaviour ──────────────────────────────────────────
    if (opts.supportsVersionedReads) {
      describe('versioned reads', () => {
        it('get with version pin returns that historical version', async () => {
          const repo = await factory();
          const ref = refOf();
          const a = await repo.put(ref, spec('v1'), { parentVersion: null, actor: 't' });
          await repo.put(ref, spec('v2'), { parentVersion: a.version, actor: 't' });
          const pinned = await repo.get({ ...ref, version: a.version });
          expect(pinned?.hash).toBe(a.version);
          expect(pinned?.body).toEqual(spec('v1'));
        });
      });
    }
  });
}
