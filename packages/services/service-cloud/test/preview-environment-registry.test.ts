// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect, beforeEach } from 'vitest';
import { PreviewEnvironmentRegistry } from '../src/preview/environment-registry.js';
import type { ArtifactApiClient } from '../src/artifact-api-client.js';

// ── Test doubles ─────────────────────────────────────────────────────────────

interface FakeBranchHead { commitId: string; publishedAt?: string | null }

class FakeClient {
    public lookups = 0;
    public headLookups = 0;
    public artifactInvalidations = 0;
    constructor(
        public projects: Record<string, { projectId: string; organizationId?: string }>,
        public branches: Record<string, Record<string, FakeBranchHead>> = {},
    ) { }
    async lookupProjectByShortId(short: string) {
        this.lookups++;
        return this.projects[short.toLowerCase()] ?? null;
    }
    async fetchBranchHead(projectId: string, branch: string): Promise<FakeBranchHead | null> {
        this.headLookups++;
        return this.branches[projectId]?.[branch.toLowerCase()] ?? null;
    }
    invalidate(_projectId: string) { this.artifactInvalidations++; }
}

class FakeDriver {
    static instances = 0;
    public id: number;
    constructor() { this.id = ++FakeDriver.instances; }
}

function makeRegistry(client: FakeClient) {
    return new PreviewEnvironmentRegistry({
        client: client as unknown as ArtifactApiClient,
        driverFactory: async () => new FakeDriver() as any,
        logger: { info() { }, warn() { }, error() { } },
    });
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('PreviewEnvironmentRegistry', () => {
    beforeEach(() => { FakeDriver.instances = 0; });

    describe('non-preview hostnames', () => {
        it('returns null for unrecognised hosts', async () => {
            const client = new FakeClient({});
            const reg = makeRegistry(client);
            expect(await reg.resolveByHostname('myapp.objectstack.ai')).toBeNull();
            expect(await reg.resolveByHostname('localhost')).toBeNull();
            expect(client.lookups).toBe(0);
            expect(client.headLookups).toBe(0);
        });
    });

    describe('commit-pinned previews', () => {
        it('resolves a commit host and uses composite key', async () => {
            const client = new FakeClient({
                '7f3e9a01': { projectId: '7f3e9a01-1234-5678-9abc-def012345678' },
            });
            const reg = makeRegistry(client);
            const r = await reg.resolveByHostname('abc123def4567890--7f3e9a01.preview.objectstack.ai');
            expect(r).not.toBeNull();
            expect(r!.projectId).toBe('7f3e9a01-1234-5678-9abc-def012345678:abc123def4567890');
            expect(client.lookups).toBe(1);
            expect(client.headLookups).toBe(0);
            expect(FakeDriver.instances).toBe(1);
        });

        it('caches commit entries (no second lookup)', async () => {
            const client = new FakeClient({
                '7f3e9a01': { projectId: '7f3e9a01-1234-5678-9abc-def012345678' },
            });
            const reg = makeRegistry(client);
            const host = 'abc123def4567890--7f3e9a01.preview.objectstack.ai';
            await reg.resolveByHostname(host);
            await reg.resolveByHostname(host);
            await reg.resolveByHostname(host);
            expect(client.lookups).toBe(1);
            expect(FakeDriver.instances).toBe(1);
        });

        it('peekById returns the cached project + driver', async () => {
            const client = new FakeClient({
                '7f3e9a01': { projectId: '7f3e9a01-1234-5678-9abc-def012345678' },
            });
            const reg = makeRegistry(client);
            await reg.resolveByHostname('abc123def4567890--7f3e9a01.preview.objectstack.ai');
            const peek = reg.peekById('7f3e9a01-1234-5678-9abc-def012345678:abc123def4567890');
            expect(peek).not.toBeNull();
            expect(peek!.project.commitId).toBe('abc123def4567890');
            expect(peek!.project.projectId).toBe('7f3e9a01-1234-5678-9abc-def012345678');
        });
    });

    describe('branch-tracking previews', () => {
        it('resolves a branch host using its current head', async () => {
            const client = new FakeClient(
                { '7f3e9a01': { projectId: 'proj-1' } },
                { 'proj-1': { main: { commitId: 'abc123def4567890' } } },
            );
            const reg = makeRegistry(client);
            const r = await reg.resolveByHostname('main--7f3e9a01.preview.objectstack.ai');
            expect(r!.projectId).toBe('proj-1:abc123def4567890');
            expect(client.headLookups).toBe(1);
        });

        it('re-checks branch head on every request (per-request semantics)', async () => {
            const client = new FakeClient(
                { '7f3e9a01': { projectId: 'proj-1' } },
                { 'proj-1': { main: { commitId: 'abc123def4567890' } } },
            );
            const reg = makeRegistry(client);
            const host = 'main--7f3e9a01.preview.objectstack.ai';
            await reg.resolveByHostname(host);
            await reg.resolveByHostname(host);
            await reg.resolveByHostname(host);
            // Initial resolve = 1 head call; then 2 re-checks.
            expect(client.headLookups).toBe(3);
            // Driver instance count stays at 1 because head didn't change.
            expect(FakeDriver.instances).toBe(1);
        });

        it('evicts and rebuilds when branch head advances', async () => {
            const client = new FakeClient(
                { '7f3e9a01': { projectId: 'proj-1' } },
                { 'proj-1': { main: { commitId: 'aaaaaaaaaaaaaaaa' } } },
            );
            const reg = makeRegistry(client);
            const host = 'main--7f3e9a01.preview.objectstack.ai';
            const first = await reg.resolveByHostname(host);
            expect(first!.projectId).toBe('proj-1:aaaaaaaaaaaaaaaa');

            // Advance the head.
            client.branches['proj-1']!.main = { commitId: 'bbbbbbbbbbbbbbbb' };

            const second = await reg.resolveByHostname(host);
            expect(second!.projectId).toBe('proj-1:bbbbbbbbbbbbbbbb');
            expect(client.artifactInvalidations).toBeGreaterThanOrEqual(1);
            expect(FakeDriver.instances).toBe(2); // fresh driver for the new commit
        });

        it('returns null when the branch has no head', async () => {
            const client = new FakeClient(
                { '7f3e9a01': { projectId: 'proj-1' } },
                { 'proj-1': {} }, // no `main`
            );
            const reg = makeRegistry(client);
            const r = await reg.resolveByHostname('main--7f3e9a01.preview.objectstack.ai');
            expect(r).toBeNull();
        });
    });

    describe('error paths', () => {
        it('returns null when the short id is unknown', async () => {
            const client = new FakeClient({});
            const reg = makeRegistry(client);
            const r = await reg.resolveByHostname('main--00000000.preview.objectstack.ai');
            expect(r).toBeNull();
            expect(FakeDriver.instances).toBe(0);
        });

        it('singleflights concurrent first-resolve requests', async () => {
            const client = new FakeClient(
                { '7f3e9a01': { projectId: 'proj-1' } },
                { 'proj-1': { main: { commitId: 'aaaaaaaaaaaaaaaa' } } },
            );
            const reg = makeRegistry(client);
            const host = 'main--7f3e9a01.preview.objectstack.ai';
            const [a, b, c] = await Promise.all([
                reg.resolveByHostname(host),
                reg.resolveByHostname(host),
                reg.resolveByHostname(host),
            ]);
            expect(a!.projectId).toBe('proj-1:aaaaaaaaaaaaaaaa');
            expect(b!.projectId).toBe('proj-1:aaaaaaaaaaaaaaaa');
            expect(c!.projectId).toBe('proj-1:aaaaaaaaaaaaaaaa');
            expect(client.lookups).toBe(1);
            // One head fetch during initial build, no per-request re-check
            // because all three calls dedupe through `pending`.
            expect(client.headLookups).toBe(1);
            expect(FakeDriver.instances).toBe(1);
        });
    });

    describe('clear()', () => {
        it('drops all cached entries', async () => {
            const client = new FakeClient({
                '7f3e9a01': { projectId: 'proj-1' },
            });
            const reg = makeRegistry(client);
            await reg.resolveByHostname('abc123def4567890--7f3e9a01.localhost');
            expect(reg.peekById('proj-1:abc123def4567890')).not.toBeNull();
            reg.clear();
            expect(reg.peekById('proj-1:abc123def4567890')).toBeNull();
        });
    });
});
