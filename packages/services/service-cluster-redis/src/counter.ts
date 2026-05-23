// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

import type { Redis } from 'ioredis';
import type { ICounter, CounterIncrOptions } from '@objectstack/spec/contracts';

export interface RedisCounterOptions {
    client: Redis;
    keyPrefix?: string;
}

/**
 * Redis-backed monotonic counter using INCRBY. Each counter key lives at
 * `{prefix}ctr:{key}` so the same Redis instance can host multiple
 * tenants without collision.
 *
 * Values are stored as ASCII decimals (Redis convention). We surface
 * them as `bigint` to match the contract — INCRBY accepts up to a
 * signed 64-bit range, well beyond Number.MAX_SAFE_INTEGER.
 */
export class RedisCounter implements ICounter {
    private readonly client: Redis;
    private readonly keyPrefix: string;
    private closed = false;

    constructor(opts: RedisCounterOptions) {
        this.client = opts.client;
        this.keyPrefix = opts.keyPrefix ?? 'os:';
    }

    async incr(key: string, opts: CounterIncrOptions = {}): Promise<bigint> {
        if (this.closed) throw new Error('RedisCounter is closed');
        const by = opts.by ?? 1;
        const next = await this.client.incrby(this.ctrKey(key), by);
        return BigInt(next);
    }

    async peek(key: string): Promise<bigint> {
        const raw = await this.client.get(this.ctrKey(key));
        if (raw === null) return 0n;
        try {
            return BigInt(raw);
        } catch {
            return 0n;
        }
    }

    async reset(key: string, value: bigint = 0n): Promise<void> {
        if (this.closed) throw new Error('RedisCounter is closed');
        if (value === 0n) {
            await this.client.del(this.ctrKey(key));
            return;
        }
        await this.client.set(this.ctrKey(key), value.toString());
    }

    async close(): Promise<void> {
        this.closed = true;
    }

    private ctrKey(key: string): string {
        return `${this.keyPrefix}ctr:${key}`;
    }
}
