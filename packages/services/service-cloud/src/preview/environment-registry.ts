// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Preview EnvironmentDriverRegistry.
 *
 * Resolves preview hostnames (`<ref>--<pidShort>.<base>`) to a composite
 * key `${projectId}:${commitId}` so each (project, commit) pair owns its
 * own kernel slot in the {@link KernelManager}. Each composite key gets
 * a *fresh* in-memory data driver — the preview runtime never touches a
 * project's real database.
 *
 * For branch-tracking previews (`<branchSlug>--<pid>...`) the registry
 * resolves the slug's HEAD commit per request and triggers cache
 * invalidation when the HEAD has advanced. The kernel for the OLD commit
 * is then evicted so the next request gets a fresh one bound to the new
 * artifact (and a fresh memory driver — schema may have changed).
 *
 * This registry implements the EnvironmentDriverRegistry surface
 * (resolveByHostname / resolveById / peekById) so the existing
 * dispatcher and KernelManager can use it unchanged.
 */

import type * as Contracts from '@objectstack/spec/contracts';
import type { EnvironmentDriverRegistry } from '../environment-registry.js';
import type { ArtifactApiClient } from '../artifact-api-client.js';
import type { KernelManager } from '../kernel-manager.js';
import { parsePreviewHost, type PreviewParseConfig } from './host-parser.js';

type IDataDriver = Contracts.IDataDriver;

interface CompositeProject {
    id: string;                     // composite key: `${projectId}:${commitId}`
    projectId: string;              // real project UUID
    commitId: string;               // pinned 16-hex commit id
    organization_id?: string;
    /** Set when the entry was resolved via a branch slug. */
    branchName?: string;
    /** HEAD commit observed at last resolve time (branch entries only). */
    branchHeadCommit?: string;
}

interface CacheEntry {
    project: CompositeProject;
    driver: IDataDriver;
    /** When did we last verify the branch head? Branch entries only. */
    headCheckedAt: number;
}

export interface PreviewEnvironmentRegistryConfig {
    client: ArtifactApiClient;
    parseConfig?: PreviewParseConfig;
    /**
     * Factory for the per-(project,commit) memory driver. Defaulted to
     * `new InMemoryDriver()` from `@objectstack/driver-memory`. Tests can
     * inject a stub.
     */
    driverFactory?: () => Promise<IDataDriver>;
    /**
     * KernelManager used to evict the previous kernel when a branch HEAD
     * advances. Optional — when omitted the registry just updates its own
     * cache and lets the kernel manager LRU sort itself out.
     */
    kernelManager?: KernelManager;
    logger?: { info?: (...a: any[]) => void; warn?: (...a: any[]) => void; error?: (...a: any[]) => void };
}

let cachedDefaultDriverFactory: (() => Promise<IDataDriver>) | null = null;
async function defaultDriverFactory(): Promise<IDataDriver> {
    if (!cachedDefaultDriverFactory) {
        const { InMemoryDriver } = await import('@objectstack/driver-memory');
        cachedDefaultDriverFactory = async () => new InMemoryDriver() as unknown as IDataDriver;
    }
    return cachedDefaultDriverFactory();
}

export class PreviewEnvironmentRegistry implements EnvironmentDriverRegistry {
    private readonly client: ArtifactApiClient;
    private readonly parseConfig?: PreviewParseConfig;
    private readonly driverFactory: () => Promise<IDataDriver>;
    private kernelManager?: KernelManager;
    private readonly logger: NonNullable<PreviewEnvironmentRegistryConfig['logger']>;

    private readonly byHost = new Map<string, CacheEntry>();
    private readonly byCompositeId = new Map<string, CacheEntry>();
    private readonly pending = new Map<string, Promise<CacheEntry | null>>();

    constructor(config: PreviewEnvironmentRegistryConfig) {
        this.client = config.client;
        this.parseConfig = config.parseConfig;
        this.driverFactory = config.driverFactory ?? defaultDriverFactory;
        this.kernelManager = config.kernelManager;
        this.logger = config.logger ?? console;
    }

    async resolveByHostname(host: string): Promise<{ projectId: string; driver: IDataDriver } | null> {
        const parsed = parsePreviewHost(host, this.parseConfig);
        if (!parsed) return null;

        // Fast path: cached entry that is still valid.
        const cached = this.byHost.get(host);
        if (cached) {
            if (parsed.kind === 'commit') {
                // Commits are immutable; cache forever (LRU evicts via the kernel manager).
                return { projectId: cached.project.id, driver: cached.driver };
            }
            // Branch-tracking: revalidate HEAD on every request (per the
            // approved design). The check is one HTTP call to the
            // control plane, cheap and predictable.
            const fresh = await this.refreshBranchHead(cached, parsed.ref);
            if (fresh) {
                return { projectId: fresh.project.id, driver: fresh.driver };
            }
            // HEAD became unresolvable (branch deleted?) — fall through to
            // re-resolve which will likely 404 too.
        }

        // Singleflight on host to avoid duplicate HEAD lookups under load.
        const inflight = this.pending.get(host);
        if (inflight) {
            const r = await inflight;
            return r ? { projectId: r.project.id, driver: r.driver } : null;
        }

        const promise = this.buildEntry(host, parsed).finally(() => {
            this.pending.delete(host);
        });
        this.pending.set(host, promise);
        const entry = await promise;
        return entry ? { projectId: entry.project.id, driver: entry.driver } : null;
    }

    async resolveById(compositeKey: string): Promise<IDataDriver | null> {
        const e = this.byCompositeId.get(compositeKey);
        return e ? e.driver : null;
    }

    peekById(compositeKey: string): { projectId: string; driver: IDataDriver; project: any } | null {
        const e = this.byCompositeId.get(compositeKey);
        if (!e) return null;
        return {
            projectId: compositeKey,
            driver: e.driver,
            project: { ...e.project, hostname: undefined },
        };
    }

    /** Drop everything (used on shutdown). */
    clear(): void {
        this.byHost.clear();
        this.byCompositeId.clear();
    }

    /** Wire the kernel manager after construction (for stale-eviction). */
    setKernelManager(km: KernelManager): void {
        (this as { kernelManager?: KernelManager }).kernelManager = km;
    }

    private async buildEntry(host: string, parsed: ReturnType<typeof parsePreviewHost>): Promise<CacheEntry | null> {
        if (!parsed) return null;

        // 1. Resolve full projectId from 8-hex prefix.
        const lookup = await this.client.lookupProjectByShortId(parsed.pidShort).catch((err) => {
            this.logger.error?.('[PreviewEnvironmentRegistry] short-id lookup failed', {
                pidShort: parsed.pidShort,
                error: err?.message ?? err,
            });
            return null;
        });
        if (!lookup) {
            this.logger.warn?.('[PreviewEnvironmentRegistry] no project for short id', { host, pidShort: parsed.pidShort });
            return null;
        }
        const { projectId, organizationId } = lookup;

        // 2. Resolve commit id.
        let commitId: string;
        let branchName: string | undefined;
        if (parsed.kind === 'commit') {
            commitId = parsed.ref;
        } else {
            branchName = parsed.ref;
            const head = await this.client.fetchBranchHead(projectId, branchName).catch((err) => {
                this.logger.error?.('[PreviewEnvironmentRegistry] branch head lookup failed', {
                    projectId, branch: branchName, error: err?.message ?? err,
                });
                return null;
            });
            if (!head) {
                this.logger.warn?.('[PreviewEnvironmentRegistry] no head for branch', { host, projectId, branch: branchName });
                return null;
            }
            commitId = head.commitId;
        }

        const compositeId = `${projectId}:${commitId}`;
        const driver = await this.driverFactory();
        const project: CompositeProject = {
            id: compositeId,
            projectId,
            commitId,
            organization_id: organizationId,
            branchName,
            branchHeadCommit: branchName ? commitId : undefined,
        };

        const entry: CacheEntry = { project, driver, headCheckedAt: Date.now() };
        this.byHost.set(host, entry);
        this.byCompositeId.set(compositeId, entry);
        this.logger.info?.('[PreviewEnvironmentRegistry] resolved preview host', {
            host, projectId, commitId, branch: branchName,
        });
        return entry;
    }

    /**
     * For branch hosts: re-check the HEAD; if it changed, evict the old
     * kernel + composite entry and lazily re-resolve. Returns the
     * (possibly new) cached entry, or `null` when re-resolution failed.
     */
    private async refreshBranchHead(cached: CacheEntry, branchName: string): Promise<CacheEntry | null> {
        const head = await this.client.fetchBranchHead(cached.project.projectId, branchName).catch((err) => {
            this.logger.warn?.('[PreviewEnvironmentRegistry] branch head re-check failed; serving cached',
                { projectId: cached.project.projectId, branch: branchName, error: err?.message ?? err });
            return null;
        });
        if (!head) {
            // Conservative: keep serving the cached version on transient
            // control-plane errors. The next request will retry.
            return cached;
        }
        if (head.commitId === cached.project.branchHeadCommit) {
            cached.headCheckedAt = Date.now();
            return cached;
        }

        // HEAD advanced — evict the stale kernel + cache entry.
        this.logger.info?.('[PreviewEnvironmentRegistry] branch HEAD advanced — evicting stale kernel', {
            projectId: cached.project.projectId,
            branch: branchName,
            oldCommit: cached.project.branchHeadCommit,
            newCommit: head.commitId,
        });
        const oldCompositeId = cached.project.id;
        this.byCompositeId.delete(oldCompositeId);
        for (const [host, e] of this.byHost) {
            if (e === cached) this.byHost.delete(host);
        }
        if (this.kernelManager) {
            try { await this.kernelManager.evict(oldCompositeId); } catch { /* best-effort */ }
        }
        // Also drop the artifact cache for the project so the next build
        // sees fresh metadata. Drops both HEAD-shaped and `@commit` keys.
        this.client.invalidate(cached.project.projectId);
        return null;
    }
}
