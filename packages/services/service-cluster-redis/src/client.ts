// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

import { Redis, type RedisOptions } from 'ioredis';

/**
 * Options accepted by {@link createRedisClient}.
 *
 * Either pass `url` (e.g. `redis://user:pass@host:6379/0`) or a full
 * ioredis `options` bag. The two are merged with `options` taking
 * precedence so callers can override individual fields parsed from the
 * URL.
 *
 * This factory is intended to be the single Redis-client construction
 * point across ObjectStack — `service-cluster-redis` uses it for the
 * driver, and `service-cache` will eventually share the same connection
 * pool via {@link CreateRedisOptions.existing}.
 */
export interface CreateRedisOptions {
    /** Connection URL. Ignored when `existing` is provided. */
    url?: string;
    /** Extra ioredis options merged on top of `url`. */
    options?: RedisOptions;
    /**
     * Bring-your-own client. When provided, this exact instance is
     * returned and `url`/`options` are ignored — useful for sharing one
     * pool across cluster + cache.
     */
    existing?: Redis;
    /**
     * If true, the returned client is created in lazyConnect mode so the
     * TCP connection happens on first command rather than at construction.
     * Default: true (matches ObjectStack's "fail at usage, not boot" stance).
     */
    lazyConnect?: boolean;
}

/**
 * Construct (or reuse) an ioredis client with ObjectStack defaults.
 *
 * Defaults applied when `existing` is absent:
 *   - `lazyConnect: true` — don't crash boot if Redis is briefly down
 *   - `maxRetriesPerRequest: 3` — bound the failure window before surfacing
 *   - `enableAutoPipelining: true` — modest throughput boost for batch workloads
 *
 * @example
 *   const client = createRedisClient({ url: 'redis://localhost:6379' });
 *
 * @example reuse one pool across services
 *   const shared = createRedisClient({ url });
 *   const clusterClient = createRedisClient({ existing: shared });
 *   const cacheClient   = createRedisClient({ existing: shared });
 */
export function createRedisClient(opts: CreateRedisOptions = {}): Redis {
    if (opts.existing) return opts.existing;

    const base: RedisOptions = {
        lazyConnect: opts.lazyConnect ?? true,
        maxRetriesPerRequest: 3,
        enableAutoPipelining: true,
    };

    if (opts.url) {
        return new Redis(opts.url, { ...base, ...opts.options });
    }
    return new Redis({ ...base, ...opts.options });
}

/**
 * Duplicate a Redis client so that pub/sub commands (which monopolize
 * the connection) don't block regular commands. Mirrors the standard
 * ioredis "two clients" pattern.
 */
export function duplicateForPubSub(client: Redis): Redis {
    return client.duplicate();
}
