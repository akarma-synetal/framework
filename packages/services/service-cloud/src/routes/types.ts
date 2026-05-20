// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Shared route-level types + tiny auth/driver helpers used by every
 * route module.
 */

import type { IDataDriver } from '@objectstack/spec/contracts';
import { fail } from '../cloud-artifact-helpers.js';
import type { StorageLike } from './storage.js';

/**
 * Bag of dependencies threaded through every route handler.
 * Centralising it here means each `register*Routes(...)` function takes
 * one argument and the assembly site stays compact.
 */
export interface RouteDeps {
    prefix: string;
    artifactRoot: string;
    keyPrefix: string;
    storage: StorageLike;
    storageAdapterName: string;
    requiredKey: string | undefined;
    controlDriverPromise: Promise<{ driver: IDataDriver; driverName: string; databaseUrl: string }>;
    /**
     * Resolve the caller's user id from the request headers using better-auth's
     * `getSession`. When the auth service is unavailable this resolves to
     * `undefined`. Optional so unit tests / legacy callers can omit it.
     */
    getCallerUserId?: (req: any) => Promise<string | undefined>;
    /** Resolve the caller's active organization id via better-auth. */
    getCallerActiveOrgId?: (req: any) => Promise<string | undefined>;
}

export type AuthResult = { ok: true; mode: 'service' | 'user' | 'open'; userId?: string } | { ok: false; status: number; body: any };

/**
 * Two-mode auth gate:
 *   1. **service-to-service**: `Authorization: Bearer <OS_CLOUD_API_KEY>` matches `requiredKey`
 *   2. **user-session**:       `getCallerUserId(req)` resolves to a valid better-auth user id
 *
 * When `requiredKey` is unset, all requests pass (legacy self-host/local-dev
 * behavior) — RBAC is then the responsibility of individual route handlers
 * (which can still call `getCallerUserId` directly).
 *
 * When `requiredKey` is set, a request passes if EITHER the bearer matches
 * OR a valid better-auth session is attached. This unblocks the Studio /
 * Console UI calling these endpoints with the user's session cookie instead
 * of the shared service token. Per-route RBAC (org membership, project
 * ownership) is still enforced by each handler — this gate only proves the
 * caller is *somebody*.
 */
export function makeCheckAuth(
    requiredKey: string | undefined,
    getCallerUserId?: (req: any) => Promise<string | undefined>,
) {
    return async (req: any): Promise<AuthResult> => {
        if (!requiredKey) return { ok: true, mode: 'open' };
        // Path 1: shared bearer secret (CLI / service-to-service)
        const header = (req.headers?.authorization ?? req.headers?.Authorization ?? '') as string;
        const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
        if (token && token === requiredKey) return { ok: true, mode: 'service' };
        // Path 2: better-auth user session (Studio / Console UI)
        if (getCallerUserId) {
            try {
                const userId = await getCallerUserId(req);
                if (userId) return { ok: true, mode: 'user', userId };
            } catch { /* fall through to 401 */ }
        }
        return { ok: false, status: 401, body: { success: false, error: 'Unauthorized' } };
    };
}

/** Lazy driver accessor — returns null and logs when control plane is unavailable. */
export function makeGetDriver(
    controlDriverPromise: Promise<{ driver: IDataDriver; driverName: string; databaseUrl: string }>,
) {
    return async (): Promise<IDataDriver | null> => {
        try {
            const { driver } = await controlDriverPromise;
            return driver ?? null;
        } catch (err: any) {
            console.error('[CloudArtifactAPI] control driver unavailable:', err?.message ?? err);
            return null;
        }
    };
}

/** Helper to ship a "control plane unavailable" 503 envelope. */
export function controlPlaneUnavailable(res: any) {
    return res.status(503).json(fail('control plane unavailable', 503));
}
