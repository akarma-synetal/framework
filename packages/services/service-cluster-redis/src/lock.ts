// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

import type { Redis } from 'ioredis';
import type {
    ILock,
    LockAcquireOptions,
    LockHandle,
} from '@objectstack/spec/contracts';

const DEFAULT_TTL_MS = 15_000;
const POLL_INTERVAL_MS = 50;

/**
 * Lua script for safe release: only DEL when the value matches our
 * fencing token. Prevents a delayed release from kicking out the
 * legitimate next holder.
 */
const RELEASE_SCRIPT = `
if redis.call("GET", KEYS[1]) == ARGV[1] then
    return redis.call("DEL", KEYS[1])
else
    return 0
end
`;

/**
 * Lua script for renew: PEXPIRE only when we still hold the lock.
 * Returns 1 on success, 0 if the lock was lost.
 */
const RENEW_SCRIPT = `
if redis.call("GET", KEYS[1]) == ARGV[1] then
    return redis.call("PEXPIRE", KEYS[1], ARGV[2])
else
    return 0
end
`;

export interface RedisLockOptions {
    client: Redis;
    /** Counter client for fencing-token allocation. Same Redis is fine. */
    counterClient?: Redis;
    keyPrefix?: string;
    defaultTtlMs?: number;
    /** Stable node id baked into lock values for debugging. */
    nodeId?: string;
}

/**
 * Redis-backed distributed lock with TTL fencing.
 *
 * Algorithm (single-instance Redis, NOT Redlock — adequate for
 * typical ObjectStack deployments with one Redis primary):
 *
 *   acquire = SET key {nodeId}:{token} NX PX ttl
 *   release = Lua: GET == expected ? DEL : 0
 *   renew   = Lua: GET == expected ? PEXPIRE : 0
 *
 * Fencing tokens come from a Redis counter (INCR on `{prefix}fence:{key}`)
 * so that two clients in a split-brain see strictly increasing tokens
 * downstream.
 *
 * For multi-master Redis (Sentinel failover, etc.) consider switching to
 * a Redlock variant — not implemented yet.
 */
export class RedisLock implements ILock {
    private readonly client: Redis;
    private readonly counterClient: Redis;
    private readonly keyPrefix: string;
    private readonly defaultTtlMs: number;
    private readonly nodeId: string;
    private closed = false;

    constructor(opts: RedisLockOptions) {
        this.client = opts.client;
        this.counterClient = opts.counterClient ?? opts.client;
        this.keyPrefix = opts.keyPrefix ?? 'os:';
        this.defaultTtlMs = opts.defaultTtlMs ?? DEFAULT_TTL_MS;
        this.nodeId = opts.nodeId ?? 'node';
    }

    async acquire(key: string, opts: LockAcquireOptions = {}): Promise<LockHandle | null> {
        if (this.closed) throw new Error('RedisLock is closed');
        const ttlMs = opts.ttlMs ?? this.defaultTtlMs;
        const waitMs = opts.waitMs ?? 0;
        const deadline = Date.now() + waitMs;
        const lockKey = this.lockKey(key);

        // Allocate a fresh fencing token up-front.
        const fencingToken = BigInt(
            await this.counterClient.incr(this.fenceKey(key)),
        );
        const value = `${this.nodeId}:${fencingToken}`;

        // First attempt — fast path.
        if (await this.trySet(lockKey, value, ttlMs)) {
            return this.makeHandle(key, lockKey, value, fencingToken, ttlMs);
        }
        if (waitMs <= 0) return null;

        // Polling loop: simple, correct, good enough for typical
        // contention. Future: pub/sub-driven wakeup on release.
        while (Date.now() < deadline) {
            await sleep(Math.min(POLL_INTERVAL_MS, Math.max(1, deadline - Date.now())));
            if (await this.trySet(lockKey, value, ttlMs)) {
                return this.makeHandle(key, lockKey, value, fencingToken, ttlMs);
            }
        }
        return null;
    }

    async withLock<T>(
        key: string,
        fn: (h: LockHandle) => Promise<T>,
        opts?: LockAcquireOptions,
    ): Promise<T | null> {
        const handle = await this.acquire(key, opts);
        if (!handle) return null;
        try {
            return await fn(handle);
        } finally {
            await handle.release();
        }
    }

    async close(): Promise<void> {
        this.closed = true;
    }

    private async trySet(lockKey: string, value: string, ttlMs: number): Promise<boolean> {
        // SET key value NX PX ttlMs — atomic acquire.
        const res = await this.client.set(lockKey, value, 'PX', ttlMs, 'NX');
        return res === 'OK';
    }

    private makeHandle(
        logicalKey: string,
        lockKey: string,
        value: string,
        fencingToken: bigint,
        ttlMs: number,
    ): LockHandle {
        const self = this;
        let released = false;
        let currentTtl = ttlMs;
        // Local expiry timer — mirrors memory driver so `isHeld()` flips
        // on TTL without a Redis roundtrip. Not authoritative (clocks may
        // drift), but matches contract test expectations.
        let timer: NodeJS.Timeout | undefined = setTimeout(() => {
            released = true;
        }, ttlMs);

        return {
            key: logicalKey,
            fencingToken,
            isHeld(): boolean {
                return !released;
            },
            async renew(extendMs?: number): Promise<void> {
                if (released) {
                    throw new Error(`Lock "${logicalKey}" already released`);
                }
                const next = extendMs ?? currentTtl;
                const result = await self.client.eval(
                    RENEW_SCRIPT,
                    1,
                    lockKey,
                    value,
                    String(next),
                );
                if (result !== 1) {
                    released = true;
                    if (timer) { clearTimeout(timer); timer = undefined; }
                    throw new Error(
                        `Lock "${logicalKey}" no longer held (fence=${fencingToken})`,
                    );
                }
                currentTtl = next;
                if (timer) clearTimeout(timer);
                timer = setTimeout(() => { released = true; }, next);
            },
            async release(): Promise<void> {
                if (released) return;
                released = true;
                if (timer) { clearTimeout(timer); timer = undefined; }
                try {
                    await self.client.eval(RELEASE_SCRIPT, 1, lockKey, value);
                } catch {
                    /* swallow — release is best-effort */
                }
            },
        };
    }

    private lockKey(key: string): string {
        return `${this.keyPrefix}lock:${key}`;
    }

    private fenceKey(key: string): string {
        return `${this.keyPrefix}fence:${key}`;
    }
}

function sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
}
