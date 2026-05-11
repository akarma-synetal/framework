// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * createPreviewStack
 *
 * Preview-mode runtime stack — a sibling of `createObjectOSStack`
 * specialised for sandbox previews of pinned (project, commit) pairs.
 *
 * Differences vs. the regular ObjectOS stack:
 *
 *   • EnvironmentDriverRegistry is `PreviewEnvironmentRegistry`, which
 *     parses `<ref>--<pidShort>.<base>` hostnames, resolves the short id
 *     to a full project, optionally resolves a branch slug to its HEAD
 *     commit, and mints a fresh in-memory driver per (project, commit).
 *   • ProjectKernelFactory is `PreviewKernelFactory`, which fetches the
 *     artifact at the pinned commit and builds a kernel against the
 *     ephemeral memory driver.
 *   • Every other moving part (host engine plugins, KernelManager,
 *     ArtifactApiClient) is identical so the dispatcher and REST plugin
 *     work without modification.
 *
 * Wiring is intentionally trivial: the host kernel registers the
 * familiar `env-registry` + `kernel-manager` + `artifact-api-client`
 * services, the dispatcher does the rest.
 */

import { Plugin, PluginContext } from '@objectstack/core';
import type { EnvironmentDriverRegistry } from '../environment-registry.js';
import { KernelManager } from '../kernel-manager.js';
import { ArtifactApiClient } from '../artifact-api-client.js';
import { PreviewEnvironmentRegistry } from './environment-registry.js';
import { PreviewKernelFactory } from './kernel-factory.js';
import type { PreviewParseConfig } from './host-parser.js';

export interface PreviewStackConfig {
    /** Control-plane base URL. Required. */
    controlPlaneUrl: string;
    /** Optional bearer token for the control-plane API. */
    controlPlaneApiKey?: string;
    /** Allowed preview base domains. Defaults to ['preview.objectstack.ai', 'localhost']. */
    baseDomains?: readonly string[];
    /** KernelManager LRU size. Default: 32. */
    kernelCacheSize?: number;
    /** KernelManager idle TTL (ms). Default: 15 min. */
    kernelTtlMs?: number;
    /** Artifact response cache TTL (ms). Default: 5 min. */
    artifactCacheTtlMs?: number;
    /** API prefix (carried for parity with sibling stacks). Default: /api/v1. */
    apiPrefix?: string;
}

export interface PreviewStackResult {
    plugins: any[];
    api: { enableProjectScoping: true; projectResolution: 'auto' };
}

/**
 * Lazy-loaded host engine plugins. Identical to the ObjectOS stack's
 * `createHostEnginePlugins()` — the host kernel is a routing shell that
 * never persists anything, so it gets a transient in-memory driver.
 */
async function createHostEnginePlugins(): Promise<Plugin[]> {
    const { ObjectQLPlugin } = await import('@objectstack/objectql');
    const { InMemoryDriver } = await import('@objectstack/driver-memory');
    const { DriverPlugin } = await import('@objectstack/runtime');
    const { MetadataPlugin } = await import('@objectstack/metadata');

    const driver = new InMemoryDriver();
    const driverName = 'memory';

    const oqlRef: { ql: any } = { ql: null };
    const objectql: Plugin = {
        name: 'com.objectstack.engine.objectql',
        version: '0.0.0',
        async init(ctx: PluginContext) {
            const plugin = new ObjectQLPlugin();
            (this as any)._inner = plugin;
            if ((plugin as any).init) await (plugin as any).init(ctx);
            oqlRef.ql = (plugin as any).ql ?? plugin;
        },
        async start(ctx: PluginContext) {
            const plugin = (this as any)._inner;
            if (plugin?.start) await plugin.start(ctx);
        },
        async stop(ctx: PluginContext) {
            const plugin = (this as any)._inner;
            if (plugin?.stop) await plugin.stop(ctx);
        },
    };

    const datasourceMapping: Plugin = {
        name: 'preview-host-datasource-mapping',
        version: '0.0.0',
        dependencies: ['com.objectstack.engine.objectql'],
        async init() {
            const ql = oqlRef.ql;
            if (ql?.setDatasourceMapping) {
                ql.setDatasourceMapping([
                    { default: true, datasource: `com.objectstack.driver.${driverName}` },
                ]);
            }
        },
    };

    const driverPlugin = new DriverPlugin(driver as any, driverName);

    const metadata = new MetadataPlugin({
        watch: false,
        registerSystemObjects: false,
    });

    return [objectql, datasourceMapping, driverPlugin as unknown as Plugin, metadata as unknown as Plugin];
}

class PreviewProjectPlugin implements Plugin {
    readonly name = 'com.objectstack.runtime.preview-project';
    readonly version = '1.0.0';

    private readonly config: PreviewStackConfig;
    private kernelManager?: KernelManager;
    private envRegistry?: PreviewEnvironmentRegistry;
    private client?: ArtifactApiClient;

    constructor(config: PreviewStackConfig) {
        this.config = config;
    }

    init = async (ctx: PluginContext): Promise<void> => {
        this.client = new ArtifactApiClient({
            controlPlaneUrl: this.config.controlPlaneUrl,
            apiKey: this.config.controlPlaneApiKey,
            cacheTtlMs: this.config.artifactCacheTtlMs,
            logger: ctx.logger,
        });

        const parseConfig: PreviewParseConfig | undefined = this.config.baseDomains
            ? { baseDomains: this.config.baseDomains }
            : undefined;

        const envRegistry = new PreviewEnvironmentRegistry({
            client: this.client,
            parseConfig,
            logger: ctx.logger,
        });
        this.envRegistry = envRegistry;

        const factory = new PreviewKernelFactory({
            client: this.client,
            envRegistry,
            logger: ctx.logger,
        });

        const kernelManager = new KernelManager({
            factory,
            maxSize: this.config.kernelCacheSize,
            ttlMs: this.config.kernelTtlMs,
            logger: ctx.logger,
        });
        envRegistry.setKernelManager(kernelManager);
        this.kernelManager = kernelManager;

        ctx.registerService('env-registry', envRegistry as unknown as EnvironmentDriverRegistry);
        ctx.registerService('kernel-manager', kernelManager);
        ctx.registerService('artifact-api-client', this.client);

        ctx.logger.info?.('PreviewProjectPlugin: registered preview env-registry + kernel-manager', {
            controlPlaneUrl: this.config.controlPlaneUrl,
            baseDomains: this.config.baseDomains ?? ['preview.objectstack.ai', 'localhost'],
        });
    };

    destroy = async (): Promise<void> => {
        try { await this.kernelManager?.evictAll(); } catch { /* best effort */ }
        try { this.envRegistry?.clear(); } catch { /* best effort */ }
        try { this.client?.clear(); } catch { /* best effort */ }
    };
}

export async function createPreviewStack(config: PreviewStackConfig): Promise<PreviewStackResult> {
    if (!config.controlPlaneUrl) {
        throw new Error('[createPreviewStack] controlPlaneUrl is required');
    }
    const merged: PreviewStackConfig = {
        ...config,
        kernelCacheSize: Number(process.env.OS_KERNEL_CACHE_SIZE ?? config.kernelCacheSize ?? 32),
        kernelTtlMs: Number(process.env.OS_KERNEL_TTL_MS ?? config.kernelTtlMs ?? 15 * 60 * 1000),
        artifactCacheTtlMs: Number(process.env.OS_ARTIFACT_CACHE_TTL_MS ?? config.artifactCacheTtlMs ?? 5 * 60 * 1000),
        baseDomains: config.baseDomains
            ?? (process.env.OS_PREVIEW_BASE_DOMAINS
                ? process.env.OS_PREVIEW_BASE_DOMAINS.split(',').map((s) => s.trim()).filter(Boolean)
                : undefined),
    };

    const enginePlugins = await createHostEnginePlugins();

    return {
        plugins: [...enginePlugins, new PreviewProjectPlugin(merged)],
        api: {
            enableProjectScoping: true,
            projectResolution: 'auto',
        },
    };
}
