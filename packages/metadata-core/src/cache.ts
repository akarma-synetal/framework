// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * `MetadataCache` — bounded, event-invalidated LRU sitting in front of a
 * `MetadataRepository`. See ADR-0008 §2.5.
 *
 * Design contract
 * ───────────────
 *
 *   1. **Lazy fill.** Cache entries are only created on first read miss.
 *      No bulk preload — that would defeat the whole point of being
 *      bounded.
 *   2. **Event-driven invalidation.** The cache subscribes to
 *      `repo.watch({...})` and drops or replaces affected entries
 *      whenever the repository emits an event. Stale reads are bounded
 *      by the event-propagation latency of the underlying repo.
 *   3. **Bounded.** Both `maxEntries` and `maxBytes` are enforced; LRU
 *      eviction happens on `set()` when either limit is exceeded.
 *   4. **Coherent under races.** Concurrent `get()`s for the same key
 *      coalesce onto a single backend fetch (the "thundering herd"
 *      fix). If an invalidation event arrives during an in-flight
 *      fetch, the resulting value is discarded — the next read fetches
 *      fresh.
 *   5. **Negative caching.** A miss (repo returned `null`) is also
 *      cached, with a smaller TTL semantics — it stays until an event
 *      for that ref arrives. This makes "does X exist?" cheap during
 *      tight loops without compromising correctness.
 */

import type { MetaRef, MetadataItem, MetadataEvent, WatchFilter } from './types.js';
import { refKey } from './types.js';
import type { MetadataRepository } from './repository.js';

export interface MetadataCacheOptions {
  /** Maximum number of entries to keep. Default: 1024. */
  maxEntries?: number;
  /**
   * Maximum approximate body size in bytes. Default: 8 MiB. Each entry's
   * size is estimated from `JSON.stringify(item.body).length`.
   */
  maxBytes?: number;
  /**
   * Watch filter. Only events matching this filter invalidate cache
   * entries. Default: no filter (all events).
   */
  watchFilter?: WatchFilter;
}

interface CacheEntry {
  /** Null = negative cache (item is known absent). */
  item: MetadataItem | null;
  size: number;
  /** Hit count, just for diagnostics. */
  hits: number;
}

export interface CacheStats {
  entries: number;
  bytes: number;
  hits: number;
  misses: number;
  invalidations: number;
  /** Reads that arrived while a fetch was already in-flight for the same key. */
  coalesced: number;
}

export class MetadataCache {
  private readonly repo: MetadataRepository;
  private readonly maxEntries: number;
  private readonly maxBytes: number;
  private readonly watchFilter: WatchFilter;

  /** LRU is implemented via insertion-order Map; touch on get/set. */
  private readonly entries = new Map<string, CacheEntry>();
  private bytes = 0;

  /** De-duplicate concurrent fetches for the same key. */
  private readonly inflight = new Map<string, Promise<MetadataItem | null>>();
  /**
   * Generation counter incremented on every invalidation. Each in-flight
   * fetch captures the gen at start; if the gen changes before it
   * resolves, the result is NOT cached.
   */
  private readonly fetchGen = new Map<string, number>();

  private watchIterator: AsyncIterator<MetadataEvent> | null = null;
  private watchClosed = false;
  private watchLoop: Promise<void> | null = null;

  private readonly stats: CacheStats = {
    entries: 0,
    bytes: 0,
    hits: 0,
    misses: 0,
    invalidations: 0,
    coalesced: 0,
  };

  constructor(repo: MetadataRepository, opts: MetadataCacheOptions = {}) {
    this.repo = repo;
    this.maxEntries = opts.maxEntries ?? 1024;
    this.maxBytes = opts.maxBytes ?? 8 * 1024 * 1024;
    this.watchFilter = opts.watchFilter ?? {};
  }

  /**
   * Start the background watch subscription. Idempotent; safe to call
   * multiple times. Caller is responsible for calling `close()` when
   * the cache is no longer needed.
   */
  start(): void {
    if (this.watchIterator || this.watchClosed) return;
    const iter = this.repo.watch(this.watchFilter)[Symbol.asyncIterator]();
    this.watchIterator = iter;
    this.watchLoop = (async () => {
      try {
        while (!this.watchClosed) {
          const { value, done } = await iter.next();
          if (done) return;
          this.applyEvent(value);
        }
      } catch {
        // Repository tore down its event stream; cache is left in a
        // best-effort state. Consumers can detect this via stats or by
        // restarting the cache.
      }
    })();
  }

  /** Tear down the watch subscription and clear in-flight tracking. */
  async close(): Promise<void> {
    this.watchClosed = true;
    if (this.watchIterator?.return) {
      try {
        await this.watchIterator.return(undefined);
      } catch {
        // ignore
      }
    }
    this.watchIterator = null;
    if (this.watchLoop) {
      try {
        await this.watchLoop;
      } catch {
        // ignore
      }
      this.watchLoop = null;
    }
    this.inflight.clear();
  }

  /** Read with cache. Coalesces concurrent reads for the same key. */
  async get(ref: MetaRef): Promise<MetadataItem | null> {
    const key = refKey(ref);
    const cached = this.entries.get(key);
    if (cached) {
      // Touch (LRU bump).
      this.entries.delete(key);
      this.entries.set(key, cached);
      cached.hits += 1;
      this.stats.hits += 1;
      return cached.item ? clone(cached.item) : null;
    }

    const existing = this.inflight.get(key);
    if (existing) {
      this.stats.coalesced += 1;
      const item = await existing;
      return item ? clone(item) : null;
    }

    this.stats.misses += 1;
    const gen = (this.fetchGen.get(key) ?? 0);
    const promise = this.repo
      .get(ref)
      .then((item) => {
        // If the cache was invalidated for this key during the fetch,
        // skip caching the (possibly stale) result.
        if ((this.fetchGen.get(key) ?? 0) === gen) {
          this.cacheSet(key, item);
        }
        return item;
      })
      .finally(() => {
        this.inflight.delete(key);
      });

    this.inflight.set(key, promise);
    const item = await promise;
    return item ? clone(item) : null;
  }

  /** Drop a single entry by ref. */
  invalidate(ref: MetaRef): void {
    const key = refKey(ref);
    this.bumpGen(key);
    const removed = this.entries.get(key);
    if (removed) {
      this.bytes -= removed.size;
      this.entries.delete(key);
    }
    this.stats.invalidations += 1;
  }

  /** Drop the entire cache (e.g. on a reset). */
  clear(): void {
    this.entries.clear();
    this.bytes = 0;
    // Bump every in-flight key so we don't accidentally cache stale data.
    for (const key of this.inflight.keys()) this.bumpGen(key);
  }

  getStats(): Readonly<CacheStats> {
    return {
      ...this.stats,
      entries: this.entries.size,
      bytes: this.bytes,
    };
  }

  // ── Internals ───────────────────────────────────────────────────────

  private applyEvent(evt: MetadataEvent): void {
    // Any op (create/update/delete/rename) invalidates the affected key.
    // We don't try to be clever (e.g. preloading the new value) — the
    // next reader will pull the fresh body through `get`.
    const ref = evt.ref;
    this.invalidate(ref);
    if (evt.op === 'rename' && evt.previousName) {
      this.invalidate({ ...ref, name: evt.previousName });
    }
  }

  private cacheSet(key: string, item: MetadataItem | null): void {
    const size = item ? estimateSize(item) : 0;
    const existing = this.entries.get(key);
    if (existing) this.bytes -= existing.size;
    this.entries.set(key, { item, size, hits: 0 });
    this.bytes += size;
    this.evictIfNeeded();
  }

  private evictIfNeeded(): void {
    // Map preserves insertion order; oldest first. Touch on `get` moves
    // entries to the end → eviction from the front evicts the LRU.
    while (
      this.entries.size > this.maxEntries ||
      this.bytes > this.maxBytes
    ) {
      const first = this.entries.keys().next();
      if (first.done) break;
      const key = first.value;
      const entry = this.entries.get(key)!;
      this.bytes -= entry.size;
      this.entries.delete(key);
    }
  }

  private bumpGen(key: string): void {
    this.fetchGen.set(key, (this.fetchGen.get(key) ?? 0) + 1);
  }
}

function estimateSize(item: MetadataItem): number {
  // Rough estimate — JS strings are 2 bytes per char, but JSON.stringify
  // length is a fine proxy. Add a fixed overhead for the wrapper fields.
  try {
    return JSON.stringify(item.body).length * 2 + 256;
  } catch {
    return 1024; // fallback for unstringifiable bodies
  }
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
