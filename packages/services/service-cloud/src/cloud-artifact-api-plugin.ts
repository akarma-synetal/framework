// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Cloud-side Artifact API plugin (P0 + P1).
 *
 * Thin assembler: resolves storage backend + driver, then delegates route
 * registration to the `routes/cloud.ts` and `routes/public.ts` modules.
 *
 *   P0 — Pluggable storage via {@link IStorageService} (fallback to local FS).
 *   P1 — Version history via `sys_project_revision`, commit-aware GET, rollback.
 *
 * Routes registered:
 *   GET  /cloud/resolve-hostname?host=...
 *   GET  /cloud/projects/:id/artifact[?commit=...]
 *   POST /cloud/projects/:id/metadata
 *   GET  /cloud/projects/:id/revisions
 *   POST /cloud/projects/:id/revisions/:commit/activate
 *   POST /cloud/projects/:id/revisions/prune
 *   GET  /pub/v1/projects/:id/manifest.json
 *   GET  /pub/v1/projects/:id/artifact[?commit=&redirect=]
 *   GET  /pub/v1/projects/:id/revisions
 */

import type { IHttpServer, IDataDriver, IStorageService } from '@objectstack/spec/contracts';
import { resolveStorage } from './routes/storage.js';
import { registerCloudRoutes } from './routes/cloud.js';
import { registerPublicRoutes } from './routes/public.js';
import type { RouteDeps } from './routes/types.js';

type AnyContext = any;

export interface CloudArtifactApiPluginOptions {
    /** Promise resolving to the control-plane driver. */
    controlDriverPromise: Promise<{ driver: IDataDriver; driverName: string; databaseUrl: string }>;
    /** API prefix (default `/api/v1`). */
    apiPrefix?: string;
    /** Filesystem root for relative `artifact_path` values (default `process.cwd()`). */
    artifactRoot?: string;
    /** Bearer token required on requests. */
    apiKey?: string;
    /** Pluggable storage backend. When omitted, tries kernel's `file-storage` service; falls back to local FS. */
    storage?: {
        service?: 'file-storage' | IStorageService;
        keyPrefix?: string;
    };
}

export function createCloudArtifactApiPlugin(options: CloudArtifactApiPluginOptions): any {
    const prefix = options.apiPrefix ?? '/api/v1';
    const artifactRoot = options.artifactRoot ?? process.env.OS_PROJECT_ARTIFACT_ROOT ?? process.cwd();
    const requiredKey = options.apiKey ?? process.env.OS_CLOUD_API_KEY;
    const keyPrefix = options.storage?.keyPrefix ?? 'artifacts';

    return {
        name: 'com.objectstack.cloud.artifact-api',
        version: '2.0.0',
        init: async (_ctx: AnyContext) => {},
        start: async (ctx: AnyContext) => {
            let server: IHttpServer | undefined;
            try { server = ctx.getService('http.server') as IHttpServer | undefined; } catch { return; }
            if (!server) return;

            const { storage, adapterName: storageAdapterName } = resolveStorage(ctx, options, artifactRoot);

            const deps: RouteDeps = {
                prefix,
                artifactRoot,
                keyPrefix,
                storage,
                storageAdapterName,
                requiredKey,
                controlDriverPromise: options.controlDriverPromise,
            };

            registerCloudRoutes(server, deps);
            registerPublicRoutes(server, deps);
        },
        stop: async (_ctx: AnyContext) => {},
    };
}
