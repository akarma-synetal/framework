// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Storage backend resolution + key layout + legacy-FS fallback reader.
 *
 * Extracted from `cloud-artifact-api-plugin.ts` so the plugin file can stay
 * focused on route assembly.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve as resolvePath, dirname } from 'node:path';
import type { IStorageService } from '@objectstack/spec/contracts';

/**
 * Subset of {@link IStorageService} the artifact API actually uses. Keeping
 * a narrow shape lets us plug in a local-FS fallback without depending on
 * the full storage contract.
 */
export interface StorageLike {
    upload(key: string, data: Buffer): Promise<void>;
    download(key: string): Promise<Buffer>;
    exists(key: string): Promise<boolean>;
    delete?(key: string): Promise<void>;
    getSignedUrl?(key: string, ttlSeconds?: number): Promise<string | null>;
}

/** Backwards-compatible local-FS adapter — used when no storage service is registered. */
export function createLocalFsStorage(root: string): StorageLike {
    const abs = (key: string) => resolvePath(root, key);
    return {
        async upload(key, data) {
            const p = abs(key);
            await mkdir(dirname(p), { recursive: true });
            await writeFile(p, data);
        },
        async download(key) {
            return readFile(abs(key));
        },
        async exists(key) {
            try { await readFile(abs(key)); return true; } catch { return false; }
        },
        async delete(key) {
            const { unlink } = await import('node:fs/promises');
            try { await unlink(abs(key)); } catch { /* ignore missing */ }
        },
    };
}

/**
 * Resolve which storage backend to use, in order of preference:
 *   1. Explicit {@link IStorageService} instance passed in options.
 *   2. Kernel-registered `file-storage` service.
 *   3. Local filesystem under `artifactRoot` (last-resort fallback).
 */
export function resolveStorage(
    ctx: any,
    options: { storage?: { service?: 'file-storage' | IStorageService } },
    artifactRoot: string,
): { storage: StorageLike; adapterName: string } {
    if (options.storage?.service && typeof options.storage.service !== 'string') {
        return { storage: options.storage.service as unknown as StorageLike, adapterName: 'file-storage:custom' };
    }
    try {
        const svc = ctx.getService('file-storage') as IStorageService | undefined;
        if (svc && typeof svc.upload === 'function') {
            return { storage: svc as unknown as StorageLike, adapterName: 'file-storage' };
        }
    } catch { /* not registered */ }

    console.warn(
        '[CloudArtifactAPI] No IStorageService registered (file-storage). ' +
        'Falling back to local filesystem at ' + artifactRoot + '. ' +
        'Register StorageServicePlugin for S3/production deployments.',
    );
    return { storage: createLocalFsStorage(artifactRoot), adapterName: 'local-fs' };
}

/**
 * Object-store key shape.
 *
 * Org-first prefixing makes per-tenant cleanup, billing, IAM bucket
 * policies (e.g. allow read-only on `orgs/<id>/*`), and data-export much
 * easier in a multi-tenant cloud.
 *
 * Falls back to the legacy `${keyPrefix}/${projectId}/${commitId}.json`
 * shape when the project has no organization_id (single-tenant installs /
 * very old data). The GET path always reads the exact key from
 * `sys_environment_revision.storage_key`, so historical rows keep working
 * regardless of which layout was active when they were written.
 */
export function buildStorageKey(
    keyPrefix: string,
    orgId: string | null | undefined,
    projectId: string,
    commitId: string,
): string {
    return orgId
        ? `${keyPrefix}/orgs/${orgId}/projects/${projectId}/${commitId}.json`
        : `${keyPrefix}/${projectId}/${commitId}.json`;
}

/** Legacy reader for `artifact_path` rows that pre-date the revision table. */
export async function readLegacyArtifactFile(absPath: string): Promise<any | null> {
    try {
        const raw = await readFile(absPath, 'utf-8');
        return JSON.parse(raw);
    } catch (err: any) {
        console.warn(`[CloudArtifactAPI] Failed to read artifact '${absPath}': ${err?.message ?? err}`);
        return null;
    }
}
