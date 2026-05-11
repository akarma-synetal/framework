// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Preview ProjectKernelFactory.
 *
 * Builds a per-(project, commit) sandbox kernel for the preview runtime:
 *
 *  • Receives a composite key `${projectId}:${commitId}` from
 *    {@link KernelManager.getOrCreate}.
 *  • Resolves the cached entry from {@link PreviewEnvironmentRegistry}
 *    (the registry has already minted a fresh in-memory driver).
 *  • Fetches the artifact at exactly `commitId` from the control plane.
 *  • Bootstraps an isolated `ObjectKernel` with DriverPlugin (memory) +
 *    ObjectQL + Metadata + AppPlugin — same shape as
 *    {@link ArtifactKernelFactory}, but always pinned to a commit and
 *    always backed by ephemeral storage.
 *
 * The kernel never reads from a project's real database. Sandbox data
 * lives in-process and is lost when the kernel is evicted (LRU / TTL /
 * branch-HEAD-advance).
 */

import { ObjectKernel } from '@objectstack/core';
import { DriverPlugin, AppPlugin } from '@objectstack/runtime';
import type { ProjectKernelFactory } from '../kernel-manager.js';
import type { ArtifactApiClient } from '../artifact-api-client.js';
import type { PreviewEnvironmentRegistry } from './environment-registry.js';

export interface PreviewKernelFactoryConfig {
    client: ArtifactApiClient;
    envRegistry: PreviewEnvironmentRegistry;
    logger?: { info?: (...a: any[]) => void; warn?: (...a: any[]) => void; error?: (...a: any[]) => void };
    kernelConfig?: ConstructorParameters<typeof ObjectKernel>[0];
}

export class PreviewKernelFactory implements ProjectKernelFactory {
    private readonly client: ArtifactApiClient;
    private readonly envRegistry: PreviewEnvironmentRegistry;
    private readonly logger: NonNullable<PreviewKernelFactoryConfig['logger']>;
    private readonly kernelConfig?: PreviewKernelFactoryConfig['kernelConfig'];

    constructor(config: PreviewKernelFactoryConfig) {
        this.client = config.client;
        this.envRegistry = config.envRegistry;
        this.logger = config.logger ?? console;
        this.kernelConfig = config.kernelConfig;
    }

    async create(compositeKey: string): Promise<ObjectKernel> {
        const sep = compositeKey.lastIndexOf(':');
        if (sep <= 0 || sep === compositeKey.length - 1) {
            throw new Error(
                `[PreviewKernelFactory] expected composite key '<projectId>:<commitId>', got '${compositeKey}'`,
            );
        }
        const projectId = compositeKey.slice(0, sep);
        const commitId = compositeKey.slice(sep + 1);

        const cached = this.envRegistry.peekById(compositeKey);
        if (!cached) {
            throw new Error(
                `[PreviewKernelFactory] no env-registry entry for composite key '${compositeKey}'. ` +
                `The registry must resolve the host before the kernel manager calls create().`,
            );
        }

        const artifact = await this.client.fetchArtifact(projectId, { commit: commitId });
        if (!artifact) {
            throw new Error(
                `[PreviewKernelFactory] artifact not found for project '${projectId}' commit '${commitId}'`,
            );
        }

        const { ObjectQLPlugin } = await import('@objectstack/objectql');
        const { MetadataPlugin } = await import('@objectstack/metadata');

        const kernel = new ObjectKernel(this.kernelConfig);
        const project = cached.project as {
            organization_id?: string;
            branchName?: string;
            commitId: string;
            projectId: string;
        };

        await kernel.use(new DriverPlugin(cached.driver));
        await kernel.use(new ObjectQLPlugin({ projectId }));
        await kernel.use(new MetadataPlugin({
            watch: false,
            projectId,
            organizationId: project.organization_id,
            registerSystemObjects: false,
        }));

        const bundle = artifact.metadata as any;
        const sys = bundle?.manifest ?? bundle;
        const packageId = sys?.packageId ?? sys?.package_id ?? bundle?.packageId;

        await kernel.use(new AppPlugin(bundle, {
            projectId,
            organizationId: project.organization_id ?? '',
            // Surface the commit/branch in the project name so logs are
            // unambiguous when multiple sandboxes are resident.
            projectName: project.branchName
                ? `${projectId}@${project.branchName}#${commitId.slice(0, 12)}`
                : `${projectId}#${commitId.slice(0, 12)}`,
            packageId,
            source: packageId ? 'package' : 'user',
        } as any));

        await kernel.bootstrap();

        this.logger.info?.('[PreviewKernelFactory] sandbox ready', {
            projectId,
            commitId,
            branch: project.branchName,
            checksum: artifact.checksum,
        });

        return kernel;
    }
}
