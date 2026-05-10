// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Tests for the public, unauthenticated artifact API
 * (`/pub/v1/projects/:id/*`) and its visibility gating.
 *
 *   - sys_project.visibility = 'private'  → 404 on every public route
 *   - sys_project.visibility = 'unlisted' → 404 on /artifact without ?commit=,
 *                                            200 on /artifact?commit=<id>,
 *                                            404 on /revisions and /manifest.json
 *   - sys_project.visibility = 'public'   → 200 on all three routes
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createCloudArtifactApiPlugin } from '../src/cloud-artifact-api-plugin.js';

interface Route { method: 'GET' | 'POST'; path: string; handler: (req: any, res: any) => any; }
interface Captured { status: number; body: any; headers: Record<string, string>; }

class FakeHttpServer {
    routes: Route[] = [];
    get(path: string, handler: (req: any, res: any) => any) { this.routes.push({ method: 'GET', path, handler }); }
    post(path: string, handler: (req: any, res: any) => any) { this.routes.push({ method: 'POST', path, handler }); }
    async invoke(method: 'GET' | 'POST', urlPath: string, opts: { query?: Record<string, string>; headers?: Record<string, string> } = {}): Promise<Captured> {
        const route = this.routes.find((r) => r.method === method && pathMatches(r.path, urlPath));
        if (!route) return { status: 404, body: { error: 'no route' }, headers: {} };
        const params = extractParams(route.path, urlPath);
        const req = { params, query: opts.query ?? {}, headers: opts.headers ?? {} };
        const captured: Captured = { status: 200, body: undefined, headers: {} };
        const res: any = {
            status(code: number) { captured.status = code; return res; },
            json(body: any) { captured.body = body; return res; },
            set(name: string, value: string) { captured.headers[name.toLowerCase()] = value; return res; },
        };
        await route.handler(req, res);
        return captured;
    }
}
function pathMatches(pattern: string, actual: string): boolean {
    const a = pattern.split('/'); const b = actual.split('/');
    if (a.length !== b.length) return false;
    return a.every((seg, i) => seg.startsWith(':') || seg === b[i]);
}
function extractParams(pattern: string, actual: string): Record<string, string> {
    const out: Record<string, string> = {};
    pattern.split('/').forEach((seg, i) => { if (seg.startsWith(':')) out[seg.slice(1)] = actual.split('/')[i]; });
    return out;
}

interface FakeProject {
    id: string; organization_id?: string; visibility?: 'private' | 'unlisted' | 'public';
    metadata?: any; display_name?: string;
}
interface FakeRevision {
    project_id: string; commit_id: string; checksum: string; storage_key: string;
    size_bytes: number; built_at: string; published_at: string; is_current: boolean; note?: string;
}

class FakeDriver {
    constructor(public projects: FakeProject[], public revisions: FakeRevision[] = []) {}
    async findOne(table: string, query: any): Promise<any> {
        const where = query?.where ?? {};
        const all = table === 'sys_project' ? this.projects
                  : table === 'sys_project_revision' ? this.revisions
                  : [];
        return all.find((row: any) => Object.entries(where).every(([k, v]) => row[k] === v)) ?? null;
    }
    async find(table: string, query: any): Promise<any[]> {
        const where = query?.where ?? {};
        const rows = table === 'sys_project_revision' ? this.revisions : [];
        let filtered = rows.filter((r: any) => Object.entries(where).every(([k, v]) => r[k] === v));
        if (query?.orderBy?.[0]) {
            const { field, direction } = query.orderBy[0];
            filtered = [...filtered].sort((a: any, b: any) =>
                direction === 'desc' ? String(b[field]).localeCompare(String(a[field])) : String(a[field]).localeCompare(String(b[field])),
            );
        }
        if (typeof query?.limit === 'number') filtered = filtered.slice(0, query.limit);
        return filtered;
    }
}

class FakeStorage {
    constructor(public files: Map<string, Buffer> = new Map()) {}
    async exists(key: string) { return this.files.has(key); }
    async download(key: string) { return this.files.get(key)!; }
    async upload(key: string, data: Buffer) { this.files.set(key, data); }
}

const sampleArtifact = {
    schemaVersion: '0.1',
    projectId: 'proj_a',
    commitId: 'cafebabe',
    metadata: { objects: [{ name: 'task' }] },
    functions: [],
    manifest: { plugins: [], drivers: [], engines: {} },
};

describe('public artifact API (/pub/v1/projects/:id/*)', () => {
    let server: FakeHttpServer;
    let storage: FakeStorage;

    beforeEach(() => {
        server = new FakeHttpServer();
        storage = new FakeStorage();
        storage.files.set('artifacts/orgs/org_1/projects/proj_a/cafebabe.json', Buffer.from(JSON.stringify(sampleArtifact)));
    });

    async function boot(projects: FakeProject[]) {
        const driver = new FakeDriver(projects, [{
            project_id: 'proj_a', commit_id: 'cafebabe', checksum: 'cafebabe' + '0'.repeat(56),
            storage_key: 'artifacts/orgs/org_1/projects/proj_a/cafebabe.json',
            size_bytes: 100, built_at: '2026-01-01T00:00:00Z', published_at: '2026-01-01T00:00:00Z',
            is_current: true,
        }]);
        const plugin = createCloudArtifactApiPlugin({
            controlDriverPromise: Promise.resolve({ driver: driver as any, driverName: 'memory', databaseUrl: 'memory://' }),
            storage: { service: storage as any },
        });
        const ctx: any = { getService: (n: string) => (n === 'http.server' ? server : n === 'file-storage' ? storage : undefined) };
        await plugin.init(ctx); await plugin.start(ctx);
    }

    // --- private --------------------------------------------------------------
    it('private project: all public routes return 404 (no leak)', async () => {
        await boot([{ id: 'proj_a', organization_id: 'org_1', visibility: 'private' }]);

        const a = await server.invoke('GET', '/api/v1/pub/v1/projects/proj_a/artifact');
        const b = await server.invoke('GET', '/api/v1/pub/v1/projects/proj_a/artifact', { query: { commit: 'cafebabe' } });
        const c = await server.invoke('GET', '/api/v1/pub/v1/projects/proj_a/revisions');
        const d = await server.invoke('GET', '/api/v1/pub/v1/projects/proj_a/manifest.json');
        expect([a.status, b.status, c.status, d.status]).toEqual([404, 404, 404, 404]);
    });

    it('private project: defaults when visibility is undefined', async () => {
        await boot([{ id: 'proj_a', organization_id: 'org_1' /* no visibility */ }]);
        const r = await server.invoke('GET', '/api/v1/pub/v1/projects/proj_a/artifact', { query: { commit: 'cafebabe' } });
        expect(r.status).toBe(404);
    });

    // --- unlisted -------------------------------------------------------------
    it('unlisted project: 404 without ?commit=, 200 with ?commit=', async () => {
        await boot([{ id: 'proj_a', organization_id: 'org_1', visibility: 'unlisted' }]);

        const enumAttempt = await server.invoke('GET', '/api/v1/pub/v1/projects/proj_a/artifact');
        expect(enumAttempt.status).toBe(404);

        const ok = await server.invoke('GET', '/api/v1/pub/v1/projects/proj_a/artifact', { query: { commit: 'cafebabe' } });
        expect(ok.status).toBe(200);
        expect(ok.body.success).toBe(true);
        expect(ok.body.data.commitId).toBe('cafebabe');
    });

    it('unlisted project: revisions and manifest are still hidden', async () => {
        await boot([{ id: 'proj_a', organization_id: 'org_1', visibility: 'unlisted' }]);
        const revs = await server.invoke('GET', '/api/v1/pub/v1/projects/proj_a/revisions');
        const mani = await server.invoke('GET', '/api/v1/pub/v1/projects/proj_a/manifest.json');
        expect(revs.status).toBe(404);
        expect(mani.status).toBe(404);
    });

    // --- public ---------------------------------------------------------------
    it('public project: artifact (current) returns 200 + immutable cache headers', async () => {
        await boot([{ id: 'proj_a', organization_id: 'org_1', visibility: 'public' }]);

        const r = await server.invoke('GET', '/api/v1/pub/v1/projects/proj_a/artifact');
        expect(r.status).toBe(200);
        expect(r.body.data.commitId).toBe('cafebabe');
        expect(r.headers['cache-control']).toContain('immutable');
        expect(r.headers['etag']).toBe('"cafebabe"');
        expect(r.headers['x-commit-id']).toBe('cafebabe');
    });

    it('public project: revisions returns history list', async () => {
        await boot([{ id: 'proj_a', organization_id: 'org_1', visibility: 'public' }]);
        const r = await server.invoke('GET', '/api/v1/pub/v1/projects/proj_a/revisions');
        expect(r.status).toBe(200);
        expect(Array.isArray(r.body.data.items)).toBe(true);
        expect(r.body.data.items[0].commitId).toBe('cafebabe');
        expect(r.body.data.items[0].isCurrent).toBe(true);
    });

    it('public project: manifest.json returns lightweight metadata', async () => {
        await boot([{ id: 'proj_a', organization_id: 'org_1', visibility: 'public', display_name: 'CRM' }]);
        const r = await server.invoke('GET', '/api/v1/pub/v1/projects/proj_a/manifest.json');
        expect(r.status).toBe(200);
        expect(r.body.data).toMatchObject({
            projectId: 'proj_a',
            organizationId: 'org_1',
            displayName: 'CRM',
            visibility: 'public',
            currentCommitId: 'cafebabe',
        });
    });

    it('public project: requesting an unknown commit returns 404', async () => {
        await boot([{ id: 'proj_a', organization_id: 'org_1', visibility: 'public' }]);
        const r = await server.invoke('GET', '/api/v1/pub/v1/projects/proj_a/artifact', { query: { commit: 'deadbeef' } });
        expect(r.status).toBe(404);
    });

    it('public routes do NOT require a bearer token even when apiKey is set', async () => {
        // Boot with apiKey set (would normally enforce auth on /cloud/* routes)
        const driver = new FakeDriver(
            [{ id: 'proj_a', organization_id: 'org_1', visibility: 'public' }],
            [{ project_id: 'proj_a', commit_id: 'cafebabe', checksum: 'cafebabe' + '0'.repeat(56),
                storage_key: 'artifacts/orgs/org_1/projects/proj_a/cafebabe.json',
                size_bytes: 100, built_at: '2026-01-01T00:00:00Z', published_at: '2026-01-01T00:00:00Z', is_current: true }],
        );
        const plugin = createCloudArtifactApiPlugin({
            controlDriverPromise: Promise.resolve({ driver: driver as any, driverName: 'memory', databaseUrl: 'memory://' }),
            storage: { service: storage as any },
            apiKey: 'super-secret',
        });
        const ctx: any = { getService: (n: string) => (n === 'http.server' ? server : storage) };
        await plugin.init(ctx); await plugin.start(ctx);

        // Authenticated /cloud route should still work; unauthenticated should fail
        const privateUnauth = await server.invoke('GET', '/api/v1/cloud/projects/proj_a/artifact');
        expect(privateUnauth.status).toBe(401);

        // Public route works with NO Authorization header
        const pub = await server.invoke('GET', '/api/v1/pub/v1/projects/proj_a/artifact');
        expect(pub.status).toBe(200);
    });
});
