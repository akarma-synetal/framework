// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Shared helpers for cloud-artifact-api-plugin.
 */

import { createHash } from 'node:crypto';
import type { IDataDriver } from '@objectstack/spec/contracts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SysProjectRow {
    id: string;
    organization_id?: string;
    hostname?: string;
    database_driver?: string;
    database_url?: string;
    database_auth_token?: string;
    metadata?: Record<string, unknown> | string;
    is_system?: boolean | number;
    visibility?: 'private' | 'unlisted' | 'public';
}

export interface SysCredentialRow {
    id: string;
    project_id: string;
    database_driver?: string;
    database_url?: string;
    database_auth_token?: string;
}

export interface SysProjectRevisionRow {
    id: string;
    project_id: string;
    commit_id: string;
    checksum?: string;
    storage_key: string;
    storage_adapter?: string;
    size_bytes?: number;
    built_at?: string;
    built_with?: string;
    published_by?: string;
    published_at?: string;
    note?: string;
    is_current: boolean;
}

// ---------------------------------------------------------------------------
// Utility functions
// ---------------------------------------------------------------------------

export function ok<T>(data: T) { return { success: true, data }; }
export function fail(message: string, _status = 400) { return { success: false, error: message }; }

export function parseMetadata(raw: any): Record<string, unknown> {
    if (!raw) return {};
    if (typeof raw === 'string') {
        try { return JSON.parse(raw) ?? {}; } catch { return {}; }
    }
    if (typeof raw === 'object') return raw as Record<string, unknown>;
    return {};
}

export function extractArtifactPaths(metadata: Record<string, unknown>): string[] {
    const out: string[] = [];
    const single = metadata.artifact_path;
    if (typeof single === 'string') out.push(single);
    const list = metadata.artifact_paths;
    if (Array.isArray(list)) {
        for (const p of list) if (typeof p === 'string') out.push(p);
    }
    return out;
}

export function sha256Hex(input: string): string {
    return createHash('sha256').update(input).digest('hex');
}

/**
 * Known per-category metadata keys recognised by ObjectOS at boot.
 */
export const KNOWN_METADATA_CATEGORIES = new Set([
    'objects', 'fields', 'views', 'apps', 'pages', 'dashboards', 'reports',
    'flows', 'workflows', 'triggers', 'agents', 'tools', 'skills',
    'permissions', 'permissionSets', 'roles', 'profiles', 'translations',
    'datasources', 'datasets', 'actions', 'apis', 'i18n', 'sharingRules',
    'ragPipelines', 'data',
]);

/**
 * Merge metadata blocks from multiple artifact bundles into a single envelope.
 */
export function mergeArtifactMetadata(bundles: any[]): Record<string, any[]> {
    const merged: Record<string, any[]> = {};

    const ingest = (source: Record<string, any>) => {
        for (const [key, value] of Object.entries(source)) {
            if (!Array.isArray(value)) continue;
            if (!KNOWN_METADATA_CATEGORIES.has(key) && key !== 'manifest') {
                if (typeof key !== 'string') continue;
            }
            const bucket = merged[key] ?? (merged[key] = []);
            bucket.push(...value);
        }
    };

    for (const b of bundles) {
        if (!b || typeof b !== 'object') continue;
        const nested = (b as any).metadata;
        if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
            ingest(nested);
        }
        ingest(b as Record<string, any>);
    }
    return merged;
}

// ---------------------------------------------------------------------------
// Database helpers
// ---------------------------------------------------------------------------

export async function resolveProjectByHost(driver: IDataDriver, host: string): Promise<SysProjectRow | null> {
    if (!host) return null;
    const direct = await (driver.findOne as any)('sys_project', { where: { hostname: host } });
    if (direct) return direct as SysProjectRow;
    const wildcard = await (driver.findOne as any)('sys_project', { where: { hostname: '*' } });
    if (wildcard) return wildcard as SysProjectRow;
    return null;
}

export async function readProjectCredentials(driver: IDataDriver, projectId: string): Promise<SysCredentialRow | null> {
    try {
        const row = await (driver.findOne as any)('sys_project_credential', {
            where: { project_id: projectId },
        });
        return (row ?? null) as SysCredentialRow | null;
    } catch {
        return null;
    }
}

export function buildRuntimeBlock(project: SysProjectRow, cred: SysCredentialRow | null) {
    const driver = (cred?.database_driver ?? project.database_driver ?? '').trim();
    const url = (cred?.database_url ?? project.database_url ?? '').trim();
    if (!driver || !url) return undefined;
    const out: Record<string, any> = {
        organizationId: project.organization_id,
        hostname: project.hostname,
        databaseDriver: driver,
        databaseUrl: url,
    };
    const token = cred?.database_auth_token ?? project.database_auth_token;
    if (token) out.databaseAuthToken = token;
    return out;
}
