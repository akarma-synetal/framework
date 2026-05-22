// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Mutex / event-broker primitives used by FileSystemRepository.
 *
 * `KeyedMutex` serializes operations on the same key (refKey). The
 * broker re-uses the same manual-AsyncIterator pattern as
 * InMemoryRepository so that consumer `return()` reliably unblocks.
 */

import type { MetadataEvent, WatchFilter } from '@objectstack/metadata-core';

export class KeyedMutex {
  private readonly tails = new Map<string, Promise<unknown>>();

  async run<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const prev = this.tails.get(key) ?? Promise.resolve();
    const next = prev.then(fn, fn);
    // Save the swallowed-error tail so successive runs don't reject on
    // an unrelated prior failure.
    const swallowed = next.catch(() => undefined);
    this.tails.set(key, swallowed);
    try {
      return await next;
    } finally {
      // Best-effort cleanup: drop the entry if nothing newer was queued.
      if (this.tails.get(key) === swallowed) {
        this.tails.delete(key);
      }
    }
  }
}

export interface BrokerSubscriber {
  filter: WatchFilter;
  closed: boolean;
  push(evt: MetadataEvent): void;
}

export interface EventBroker {
  subscribe(sub: BrokerSubscriber): void;
  unsubscribe(sub: BrokerSubscriber): void;
  publish(evt: MetadataEvent): void;
}

export function createBroker(matches: (evt: MetadataEvent, filter: WatchFilter) => boolean): EventBroker {
  const subs = new Set<BrokerSubscriber>();
  return {
    subscribe: (s) => { subs.add(s); },
    unsubscribe: (s) => { subs.delete(s); },
    publish: (evt) => {
      for (const s of subs) {
        if (s.closed) continue;
        if (!matches(evt, s.filter)) continue;
        s.push(evt);
      }
    },
  };
}
