// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * `LayeredRepository` — composes N child `MetadataRepository`s into a
 * single read-through stack. See ADR-0008 §10 PR-5.
 *
 * Read semantics
 * ──────────────
 *   - `get(ref)` walks the layers top-to-bottom; first non-null wins.
 *   - `list()` deduplicates by `refKey(ref)`, preferring the top layer.
 *   - `history()` and `watch()` merge events from all layers, each
 *     tagged with the source layer label in `evt.source`
 *     (`<label>:<original-source>`).
 *
 * Write semantics
 * ───────────────
 *   - `put` / `delete` are routed to the topmost writable layer.
 *   - A layer is writable unless `readOnly: true` in its config.
 *   - The write target's existing HEAD is used for the parent check —
 *     i.e. if a key exists only in a lower layer, writing produces a
 *     create on the top layer (an "overlay" of the lower one).
 *
 * Event tagging
 * ─────────────
 *   - Each emitted event carries `source` rewritten as
 *     `<layer.label>:<source>` so subscribers can tell which layer
 *     produced the change. Original event content is otherwise
 *     unchanged.
 *
 * This implementation never re-orders events relative to seq within a
 * single layer, but seqs across layers may interleave. Downstream
 * consumers (Cache, SchemaRegistry) only need monotonicity within a
 * (layer, branch) tuple — they treat each (layer.label, ref) as a
 * separate stream.
 */

import {
  type MetadataRepository,
  type MetaRef,
  type MetadataItem,
  type MetadataItemHeader,
  type MetadataEvent,
  type PutOptions,
  type PutResult,
  type DeleteOptions,
  type DeleteResult,
  type ListFilter,
  type WatchFilter,
  type HistoryOptions,
  refKey,
} from './index.js';

export interface LayerConfig {
  /** Stable identifier for this layer (e.g. "user", "team", "system"). */
  label: string;
  /** The backing repository. */
  repo: MetadataRepository;
  /** When true, this layer rejects writes (used for built-ins). */
  readOnly?: boolean;
}

export interface LayeredRepositoryOptions {
  /**
   * Layers in priority order, highest first. The first writable layer
   * receives all writes.
   */
  layers: LayerConfig[];
}

const tagSource = (label: string, evt: MetadataEvent): MetadataEvent => ({
  ...evt,
  source: `${label}:${evt.source}`,
});

export class LayeredRepository implements MetadataRepository {
  private readonly layers: LayerConfig[];
  /** Index of the first writable layer; -1 if none. */
  private readonly writableIdx: number;

  constructor(opts: LayeredRepositoryOptions) {
    if (!opts.layers.length) {
      throw new Error('LayeredRepository requires at least one layer');
    }
    this.layers = opts.layers;
    this.writableIdx = opts.layers.findIndex((l) => !l.readOnly);
  }

  async get(ref: MetaRef): Promise<MetadataItem | null> {
    for (const layer of this.layers) {
      const item = await layer.repo.get(ref);
      if (item) return item;
    }
    return null;
  }

  async getByHash(ref: MetaRef, hash: string): Promise<MetadataItem | null> {
    // Probe layers top→bottom; first layer that resolves the hash wins.
    // executionPinned types are durable in the storage layer
    // (`SysMetadataRepository`); FS / in-memory layers only resolve
    // hash == HEAD as a fallback.
    for (const layer of this.layers) {
      const item = await layer.repo.getByHash(ref, hash);
      if (item) return item;
    }
    return null;
  }

  async put(ref: MetaRef, spec: unknown, opts: PutOptions): Promise<PutResult> {
    if (this.writableIdx < 0) {
      throw new Error('LayeredRepository: no writable layer configured');
    }
    return this.layers[this.writableIdx]!.repo.put(ref, spec, opts);
  }

  async delete(ref: MetaRef, opts: DeleteOptions): Promise<DeleteResult> {
    if (this.writableIdx < 0) {
      throw new Error('LayeredRepository: no writable layer configured');
    }
    return this.layers[this.writableIdx]!.repo.delete(ref, opts);
  }

  async *list(filter: ListFilter): AsyncIterable<MetadataItemHeader> {
    // Yield headers from top→bottom, deduplicating by refKey.
    const seen = new Set<string>();
    const limit = filter.limit ?? Infinity;
    let yielded = 0;
    for (const layer of this.layers) {
      for await (const header of layer.repo.list(filter)) {
        const key = refKey(header.ref);
        if (seen.has(key)) continue;
        seen.add(key);
        yield header;
        if (++yielded >= limit) return;
      }
    }
  }

  async *history(ref: MetaRef, opts: HistoryOptions = {}): AsyncIterable<MetadataEvent> {
    // Merge histories from all layers, tagged. Order preserves each
    // layer's monotonic seq, but events across layers may interleave.
    // We collect everything then sort by ts as a best-effort total order.
    const events: MetadataEvent[] = [];
    for (const layer of this.layers) {
      for await (const evt of layer.repo.history(ref, opts)) {
        events.push(tagSource(layer.label, evt));
      }
    }
    events.sort((a, b) => (a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0));
    const limit = opts.limit ?? Infinity;
    let yielded = 0;
    for (const evt of events) {
      yield evt;
      if (++yielded >= limit) return;
    }
  }

  watch(filter: WatchFilter, since?: number): AsyncIterable<MetadataEvent> {
    // Fan out to all child watchers; multiplex into a single iterator.
    return multiplexWatch(this.layers, filter, since);
  }
}

/**
 * Multiplex N async iterables of MetadataEvent into one, tagging each
 * event's `source` with its layer label. Implemented as a manual
 * AsyncIterator so we can correctly cancel all child iterators when the
 * consumer breaks out.
 */
function multiplexWatch(
  layers: LayerConfig[],
  filter: WatchFilter,
  since: number | undefined,
): AsyncIterable<MetadataEvent> {
  return {
    [Symbol.asyncIterator]() {
      const children = layers.map((layer) => ({
        label: layer.label,
        iter: layer.repo.watch(filter, since)[Symbol.asyncIterator](),
        pending: null as Promise<{ label: string; result: IteratorResult<MetadataEvent> }> | null,
        done: false,
      }));
      let closed = false;

      const pumpAll = () => {
        for (const c of children) {
          if (c.done || c.pending) continue;
          c.pending = c.iter.next().then((result) => ({ label: c.label, result }));
        }
      };

      const closeAll = async () => {
        if (closed) return;
        closed = true;
        await Promise.all(
          children.map(async (c) => {
            try { await c.iter.return?.(undefined); } catch { /* ignore */ }
          }),
        );
      };

      return {
        async next(): Promise<IteratorResult<MetadataEvent>> {
          while (!closed) {
            pumpAll();
            const inflight = children.filter((c) => c.pending);
            if (!inflight.length) return { value: undefined, done: true };
            const winner = await Promise.race(inflight.map((c) => c.pending!));
            const target = children.find((c) => c.label === winner.label)!;
            target.pending = null;
            if (winner.result.done) {
              target.done = true;
              continue;
            }
            return {
              value: tagSource(winner.label, winner.result.value as MetadataEvent),
              done: false,
            };
          }
          return { value: undefined, done: true };
        },
        async return() {
          await closeAll();
          return { value: undefined, done: true };
        },
        async throw(err) {
          await closeAll();
          throw err;
        },
      } as AsyncIterator<MetadataEvent>;
    },
  };
}
