// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect } from 'vitest';
import { InMemoryRepository } from '../src/in-memory-repository.js';
import { LayeredRepository } from '../src/layered-repository.js';
import type { MetaRef, MetadataEvent } from '../src/types.js';

const ref = (name: string): MetaRef => ({
  org: 'system',
  type: 'view',
  name,
});

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

describe('LayeredRepository', () => {
  it('get: top layer shadows lower layers', async () => {
    const builtins = new InMemoryRepository();
    const userspace = new InMemoryRepository();
    await builtins.put(ref('a'), { from: 'builtin' }, { parentVersion: null, actor: 't' });
    await userspace.put(ref('a'), { from: 'user' }, { parentVersion: null, actor: 't' });

    const layered = new LayeredRepository({
      layers: [
        { label: 'user', repo: userspace },
        { label: 'system', repo: builtins, readOnly: true },
      ],
    });
    const got = await layered.get(ref('a'));
    expect(got?.body).toEqual({ from: 'user' });
  });

  it('get: falls through to lower layers when top is empty', async () => {
    const builtins = new InMemoryRepository();
    const userspace = new InMemoryRepository();
    await builtins.put(ref('only_in_builtin'), { v: 1 }, { parentVersion: null, actor: 't' });

    const layered = new LayeredRepository({
      layers: [
        { label: 'user', repo: userspace },
        { label: 'system', repo: builtins, readOnly: true },
      ],
    });
    const got = await layered.get(ref('only_in_builtin'));
    expect(got?.body).toEqual({ v: 1 });
  });

  it('put: routes to the topmost writable layer', async () => {
    const builtins = new InMemoryRepository();
    const userspace = new InMemoryRepository();
    const layered = new LayeredRepository({
      layers: [
        { label: 'user', repo: userspace },
        { label: 'system', repo: builtins, readOnly: true },
      ],
    });
    await layered.put(ref('written'), { v: 1 }, { parentVersion: null, actor: 't' });
    expect(await userspace.get(ref('written'))).not.toBeNull();
    expect(await builtins.get(ref('written'))).toBeNull();
  });

  it('put: throws if no writable layer exists', async () => {
    const ro = new InMemoryRepository();
    const layered = new LayeredRepository({
      layers: [{ label: 'system', repo: ro, readOnly: true }],
    });
    await expect(
      layered.put(ref('x'), { v: 1 }, { parentVersion: null, actor: 't' }),
    ).rejects.toThrow(/no writable layer/);
  });

  it('list: deduplicates by refKey, preferring the top layer', async () => {
    const builtins = new InMemoryRepository();
    const userspace = new InMemoryRepository();
    await builtins.put(ref('shared'), { from: 'builtin' }, { parentVersion: null, actor: 't' });
    await builtins.put(ref('only_builtin'), { v: 1 }, { parentVersion: null, actor: 't' });
    await userspace.put(ref('shared'), { from: 'user' }, { parentVersion: null, actor: 't' });
    await userspace.put(ref('only_user'), { v: 1 }, { parentVersion: null, actor: 't' });

    const layered = new LayeredRepository({
      layers: [
        { label: 'user', repo: userspace },
        { label: 'system', repo: builtins, readOnly: true },
      ],
    });
    const names: string[] = [];
    for await (const header of layered.list({ type: 'view' })) {
      names.push(header.ref.name);
    }
    expect(new Set(names)).toEqual(new Set(['shared', 'only_user', 'only_builtin']));
    // 'shared' must come from user (top) → headers should be unique.
    expect(names.length).toBe(3);
  });

  it('watch: tags events with <layer>:<source>', async () => {
    const a = new InMemoryRepository();
    const b = new InMemoryRepository();
    const layered = new LayeredRepository({
      layers: [
        { label: 'top', repo: a },
        { label: 'bottom', repo: b },
      ],
    });
    const iter = layered.watch({ org: 'system' })[Symbol.asyncIterator]();
    const collected: MetadataEvent[] = [];
    const done = (async () => {
      for (let i = 0; i < 2; i++) {
        const r = await iter.next();
        if (r.done) return;
        collected.push(r.value as MetadataEvent);
      }
    })();
    await sleep(10);
    await a.put(ref('x'), { from: 'top' }, { parentVersion: null, actor: 't' });
    await b.put(ref('y'), { from: 'bottom' }, { parentVersion: null, actor: 't' });
    await Promise.race([done, sleep(1000)]);
    await iter.return?.(undefined);
    expect(collected).toHaveLength(2);
    const sources = collected.map((e) => e.source).sort();
    expect(sources).toEqual(['bottom:in-memory', 'top:in-memory']);
  });

  it('watch: closing the layered iterator closes all child iterators', async () => {
    const a = new InMemoryRepository();
    const b = new InMemoryRepository();
    const layered = new LayeredRepository({
      layers: [{ label: 'a', repo: a }, { label: 'b', repo: b }],
    });
    const iter = layered.watch({ org: 'system' })[Symbol.asyncIterator]();
    // Schedule a next() that will park (no events yet).
    const pending = iter.next();
    await sleep(10);
    // Closing must unblock pending; otherwise this test will time out.
    await iter.return?.(undefined);
    const result = await pending;
    expect(result.done).toBe(true);
  });

  it('history: merges from all layers, sorted by ts', async () => {
    const a = new InMemoryRepository({ now: () => new Date('2025-01-01T00:00:00Z') });
    const b = new InMemoryRepository({ now: () => new Date('2025-01-02T00:00:00Z') });
    await a.put(ref('item'), { who: 'a' }, { parentVersion: null, actor: 't' });
    await b.put(ref('item'), { who: 'b' }, { parentVersion: null, actor: 't' });
    const layered = new LayeredRepository({
      layers: [{ label: 'a', repo: a }, { label: 'b', repo: b }],
    });
    const events: MetadataEvent[] = [];
    for await (const evt of layered.history(ref('item'))) events.push(evt);
    expect(events).toHaveLength(2);
    expect(events[0]!.source.startsWith('a:')).toBe(true);
    expect(events[1]!.source.startsWith('b:')).toBe(true);
  });
});
