// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Tests for branch endpoints + helpers.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
    normalizeBranch,
    setBranchHead,
    groupByBranch,
    DEFAULT_BRANCH,
    BRANCH_SLUG_RE,
    registerBranchRoutes,
    type BranchHeadRow,
} from '../src/routes/branches.js';

describe('normalizeBranch', () => {
    it('returns DEFAULT_BRANCH for null/undefined/empty', () => {
        expect(normalizeBranch(undefined)).toBe('main');
        expect(normalizeBranch(null)).toBe('main');
        expect(normalizeBranch('')).toBe('main');
        expect(normalizeBranch('   ')).toBe('main');
    });

    it('lowercases and trims', () => {
        expect(normalizeBranch('  MAIN  ')).toBe('main');
        expect(normalizeBranch('Feature-X')).toBe('feature-x');
    });

    it('accepts dot, slash, dash, underscore', () => {
        expect(normalizeBranch('release/1.2.3')).toBe('release/1.2.3');
        expect(normalizeBranch('feat_billing')).toBe('feat_billing');
        expect(normalizeBranch('hotfix-abc')).toBe('hotfix-abc');
    });

    it('rejects names that do not start with [a-z0-9]', () => {
        expect(() => normalizeBranch('-bad')).toThrow(/Invalid branch name/);
        expect(() => normalizeBranch('.bad')).toThrow(/Invalid branch name/);
        expect(() => normalizeBranch('/bad')).toThrow(/Invalid branch name/);
    });

    it('rejects names with disallowed chars', () => {
        expect(() => normalizeBranch('feat space')).toThrow(/Invalid branch name/);
        expect(() => normalizeBranch('feat@x')).toThrow(/Invalid branch name/);
        expect(() => normalizeBranch('UPPER')).not.toThrow(); // gets lowercased first
    });

    it('rejects 12-hex strings (preview URL collision)', () => {
        expect(() => normalizeBranch('abcdef123456')).toThrow(/12-hex string/);
        expect(() => normalizeBranch('AABBCCDDEEFF')).toThrow(/12-hex string/);
        // 11 or 13 chars are fine
        expect(normalizeBranch('abcdef12345')).toBe('abcdef12345');
        expect(normalizeBranch('abcdef1234567')).toBe('abcdef1234567');
    });

    it('rejects names too long', () => {
        expect(() => normalizeBranch('a'.repeat(64))).toThrow(/Invalid branch name/);
        expect(normalizeBranch('a'.repeat(63))).toBe('a'.repeat(63));
    });

    it('BRANCH_SLUG_RE smoke', () => {
        expect(BRANCH_SLUG_RE.test('main')).toBe(true);
        expect(BRANCH_SLUG_RE.test('a')).toBe(true);
        expect(BRANCH_SLUG_RE.test('A')).toBe(false);
    });
});

describe('groupByBranch', () => {
    const mk = (over: Partial<BranchHeadRow>): BranchHeadRow => ({
        id: over.id ?? 'r' + Math.random(),
        project_id: over.project_id ?? 'p1',
        commit_id: over.commit_id ?? 'c' + Math.random(),
        branch: over.branch,
        is_branch_head: over.is_branch_head,
        is_current: over.is_current,
        published_at: over.published_at,
        note: over.note,
    });

    it('treats null/empty branch as DEFAULT_BRANCH', () => {
        const rows = [
            mk({ id: 'r1', commit_id: 'c1', branch: null, is_branch_head: true, published_at: '2024-01-01' }),
            mk({ id: 'r2', commit_id: 'c2', branch: '', published_at: '2023-01-01' }),
        ];
        const out = groupByBranch(rows);
        expect(out).toHaveLength(1);
        expect(out[0]?.branch).toBe('main');
        expect(out[0]?.headCommitId).toBe('c1');
        expect(out[0]?.revisionCount).toBe(2);
    });

    it('falls back to most recent when no is_branch_head set', () => {
        const rows = [
            mk({ id: 'r1', commit_id: 'old', branch: 'main', published_at: '2023-01-01' }),
            mk({ id: 'r2', commit_id: 'mid', branch: 'main', published_at: '2024-01-01' }),
            mk({ id: 'r3', commit_id: 'new', branch: 'main', published_at: '2025-01-01' }),
        ];
        const out = groupByBranch(rows);
        expect(out[0]?.headCommitId).toBe('new');
    });

    it('prefers is_branch_head over recency', () => {
        const rows = [
            mk({ id: 'r1', commit_id: 'old', branch: 'main', is_branch_head: true, published_at: '2023-01-01' }),
            mk({ id: 'r2', commit_id: 'new', branch: 'main', is_branch_head: false, published_at: '2025-01-01' }),
        ];
        const out = groupByBranch(rows);
        expect(out[0]?.headCommitId).toBe('old');
    });

    it('main branch sorts first, then by published_at desc', () => {
        const rows = [
            mk({ id: 'r1', commit_id: 'c1', branch: 'feature-a', is_branch_head: true, published_at: '2024-06-01' }),
            mk({ id: 'r2', commit_id: 'c2', branch: 'main', is_branch_head: true, published_at: '2024-01-01' }),
            mk({ id: 'r3', commit_id: 'c3', branch: 'feature-b', is_branch_head: true, published_at: '2024-12-01' }),
        ];
        const out = groupByBranch(rows);
        expect(out.map((b) => b.branch)).toEqual(['main', 'feature-b', 'feature-a']);
    });

    it('isCurrent reflects whether ANY row in the branch has is_current=true', () => {
        const rows = [
            mk({ id: 'r1', commit_id: 'a', branch: 'main', is_branch_head: true, is_current: false }),
            mk({ id: 'r2', commit_id: 'b', branch: 'staging', is_branch_head: true, is_current: true }),
        ];
        const out = groupByBranch(rows);
        const main = out.find((b) => b.branch === 'main')!;
        const staging = out.find((b) => b.branch === 'staging')!;
        expect(main.isCurrent).toBe(false);
        expect(staging.isCurrent).toBe(true);
    });

    it('returns empty array for empty input', () => {
        expect(groupByBranch([])).toEqual([]);
    });
});

describe('setBranchHead', () => {
    class FakeDriver {
        rows: Map<string, any> = new Map();
        constructor(initial: any[] = []) {
            for (const r of initial) this.rows.set(r.id, r);
        }
        async find(_table: string, q: any): Promise<any[]> {
            return [...this.rows.values()].filter((r) =>
                Object.entries(q.where).every(([k, v]) => r[k] === v),
            );
        }
        async update(_table: string, id: string, patch: any) {
            const cur = this.rows.get(id);
            if (cur) this.rows.set(id, { ...cur, ...patch });
        }
    }

    it('promotes the new row and demotes prior heads on the same branch', async () => {
        const driver = new FakeDriver([
            { id: 'r1', project_id: 'p1', branch: 'main', is_branch_head: true, commit_id: 'old' },
            { id: 'r2', project_id: 'p1', branch: 'main', is_branch_head: false, commit_id: 'mid' },
            { id: 'r3', project_id: 'p1', branch: 'main', is_branch_head: false, commit_id: 'new' },
        ]);
        await setBranchHead(driver as any, 'p1', 'main', 'r3');
        expect(driver.rows.get('r1').is_branch_head).toBe(false);
        expect(driver.rows.get('r2').is_branch_head).toBe(false);
        expect(driver.rows.get('r3').is_branch_head).toBe(true);
        expect(driver.rows.get('r3').branch).toBe('main');
    });

    it('does not touch heads on other branches', async () => {
        const driver = new FakeDriver([
            { id: 'r1', project_id: 'p1', branch: 'staging', is_branch_head: true, commit_id: 'sx' },
            { id: 'r2', project_id: 'p1', branch: 'main', is_branch_head: false, commit_id: 'mx' },
        ]);
        await setBranchHead(driver as any, 'p1', 'main', 'r2');
        expect(driver.rows.get('r1').is_branch_head).toBe(true); // staging untouched
        expect(driver.rows.get('r2').is_branch_head).toBe(true);
    });

    it('does not touch heads on other projects', async () => {
        const driver = new FakeDriver([
            { id: 'r1', project_id: 'p1', branch: 'main', is_branch_head: true, commit_id: 'a' },
            { id: 'r2', project_id: 'p2', branch: 'main', is_branch_head: true, commit_id: 'b' },
        ]);
        await setBranchHead(driver as any, 'p1', 'main', 'r1');
        expect(driver.rows.get('r2').is_branch_head).toBe(true);
    });

    it('idempotent: calling on an already-head row leaves it head', async () => {
        const driver = new FakeDriver([
            { id: 'r1', project_id: 'p1', branch: 'main', is_branch_head: true, commit_id: 'c' },
        ]);
        await setBranchHead(driver as any, 'p1', 'main', 'r1');
        await setBranchHead(driver as any, 'p1', 'main', 'r1');
        expect(driver.rows.get('r1').is_branch_head).toBe(true);
    });

    it('moves head atomically when re-publishing same commit on a different branch', async () => {
        const driver = new FakeDriver([
            { id: 'r1', project_id: 'p1', branch: 'main', is_branch_head: true, commit_id: 'shared' },
        ]);
        // Simulate publishing the same content under a new branch label
        await setBranchHead(driver as any, 'p1', 'staging', 'r1');
        expect(driver.rows.get('r1').branch).toBe('staging');
        expect(driver.rows.get('r1').is_branch_head).toBe(true);
    });
});

describe('registerBranchRoutes', () => {
    interface Route { method: string; path: string; handler: (req: any, res: any) => any }
    class FakeServer {
        routes: Route[] = [];
        get(p: string, h: any) { this.routes.push({ method: 'GET', path: p, handler: h }); }
        post(p: string, h: any) { this.routes.push({ method: 'POST', path: p, handler: h }); }
        put(p: string, h: any) { this.routes.push({ method: 'PUT', path: p, handler: h }); }
        patch(p: string, h: any) { this.routes.push({ method: 'PATCH', path: p, handler: h }); }
        delete(p: string, h: any) { this.routes.push({ method: 'DELETE', path: p, handler: h }); }
        async invoke(method: string, path: string, opts: { params?: Record<string, string>; body?: any } = {}) {
            const route = this.routes.find((r) =>
                r.method === method &&
                r.path.split('/').length === path.split('/').length &&
                r.path.split('/').every((seg, i) => seg.startsWith(':') || seg === path.split('/')[i]),
            );
            if (!route) return { status: 404, body: { error: 'no route' } };
            const a = route.path.split('/');
            const b = path.split('/');
            const params: Record<string, string> = {};
            a.forEach((seg, i) => { if (seg.startsWith(':')) params[seg.slice(1)] = b[i]!; });
            const req = { params: { ...params, ...opts.params }, query: {}, headers: {}, body: opts.body };
            let captured: any = { status: 200, body: undefined };
            const res: any = {
                status(c: number) { captured.status = c; return res; },
                json(b: any) { captured.body = b; return res; },
            };
            await route.handler(req, res);
            return captured;
        }
    }

    let driver: any;
    let server: FakeServer;

    beforeEach(() => {
        driver = {
            store: [] as any[],
            async find(_t: string, q: any) {
                return this.store.filter((r: any) =>
                    Object.entries(q.where).every(([k, v]) => r[k] === v),
                ).slice(0, q.limit ?? this.store.length);
            },
            async findOne(_t: string, q: any) {
                return this.store.find((r: any) =>
                    Object.entries(q.where).every(([k, v]) => r[k] === v),
                ) ?? null;
            },
            async update(_t: string, id: string, patch: any) {
                const r = this.store.find((x: any) => x.id === id);
                if (r) Object.assign(r, patch);
            },
        };
        server = new FakeServer();
        registerBranchRoutes(server as any, {
            prefix: '/api/v1',
            artifactRoot: '/tmp',
            keyPrefix: 'artifacts',
            storage: {} as any,
            storageAdapterName: 'test',
            requiredKey: undefined,
            controlDriverPromise: Promise.resolve({ driver, driverName: 'memory', databaseUrl: 'mem://' }),
        });
    });

    it('GET /branches returns grouped branches', async () => {
        driver.store = [
            { id: 'r1', project_id: 'p1', commit_id: 'c1', branch: 'main', is_branch_head: true, published_at: '2024-01-01', is_current: true },
            { id: 'r2', project_id: 'p1', commit_id: 'c2', branch: 'staging', is_branch_head: true, published_at: '2024-06-01' },
            { id: 'r3', project_id: 'p1', commit_id: 'c3', branch: 'staging', is_branch_head: false, published_at: '2024-05-01' },
        ];
        const res = await server.invoke('GET', '/api/v1/cloud/projects/p1/branches');
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.branches).toHaveLength(2);
        expect(res.body.data.branches[0].branch).toBe('main');
        const staging = res.body.data.branches.find((b: any) => b.branch === 'staging');
        expect(staging.headCommitId).toBe('c2');
        expect(staging.revisionCount).toBe(2);
    });

    it('DELETE /branches/main is rejected', async () => {
        driver.store = [
            { id: 'r1', project_id: 'p1', commit_id: 'c1', branch: 'main', is_branch_head: true },
        ];
        const res = await server.invoke('DELETE', '/api/v1/cloud/projects/p1/branches/main');
        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
    });

    it('DELETE /branches/<name> demotes heads, leaves rows', async () => {
        driver.store = [
            { id: 'r1', project_id: 'p1', commit_id: 'c1', branch: 'staging', is_branch_head: true, is_current: false },
            { id: 'r2', project_id: 'p1', commit_id: 'c2', branch: 'staging', is_branch_head: false, is_current: false },
        ];
        const res = await server.invoke('DELETE', '/api/v1/cloud/projects/p1/branches/staging');
        expect(res.status).toBe(200);
        expect(res.body.data.totalRevisions).toBe(2);
        expect(driver.store[0].is_branch_head).toBe(false);
        // Rows themselves still exist
        expect(driver.store).toHaveLength(2);
    });

    it('DELETE /branches/<name> rejects if branch carries the active revision', async () => {
        driver.store = [
            { id: 'r1', project_id: 'p1', commit_id: 'c1', branch: 'staging', is_branch_head: true, is_current: true },
        ];
        const res = await server.invoke('DELETE', '/api/v1/cloud/projects/p1/branches/staging');
        expect(res.status).toBe(409);
    });

    it('POST /rename succeeds when target name is free', async () => {
        driver.store = [
            { id: 'r1', project_id: 'p1', commit_id: 'c1', branch: 'feat-a', is_branch_head: true },
            { id: 'r2', project_id: 'p1', commit_id: 'c2', branch: 'feat-a', is_branch_head: false },
        ];
        const res = await server.invoke(
            'POST',
            '/api/v1/cloud/projects/p1/branches/feat-a/rename',
            { body: { newName: 'feat-A-renamed' } },
        );
        expect(res.status).toBe(200);
        expect(res.body.data.renamed).toBe(2);
        expect(driver.store.every((r: any) => r.branch === 'feat-a-renamed')).toBe(true);
    });

    it('POST /rename rejects target collision with 409', async () => {
        driver.store = [
            { id: 'r1', project_id: 'p1', commit_id: 'c1', branch: 'feat-a', is_branch_head: true },
            { id: 'r2', project_id: 'p1', commit_id: 'c2', branch: 'feat-b', is_branch_head: true },
        ];
        const res = await server.invoke(
            'POST',
            '/api/v1/cloud/projects/p1/branches/feat-a/rename',
            { body: { newName: 'feat-b' } },
        );
        expect(res.status).toBe(409);
    });

    it('POST /rename rejects invalid branch name', async () => {
        driver.store = [
            { id: 'r1', project_id: 'p1', commit_id: 'c1', branch: 'feat-a', is_branch_head: true },
        ];
        const res = await server.invoke(
            'POST',
            '/api/v1/cloud/projects/p1/branches/feat-a/rename',
            { body: { newName: '-bad' } },
        );
        expect(res.status).toBe(400);
    });
});

describe('DEFAULT_BRANCH', () => {
    it('is "main"', () => {
        expect(DEFAULT_BRANCH).toBe('main');
    });
});
