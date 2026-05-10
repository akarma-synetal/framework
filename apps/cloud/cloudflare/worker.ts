// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Cloudflare Containers entrypoint for ObjectStack Cloud.
 *
 * The Worker fronts a Container-class Durable Object that runs the
 * Node.js image built from `apps/cloud/Dockerfile`. All HTTP traffic is
 * forwarded 1:1 to the container on port 4000.
 *
 * Deploy with:
 *   wrangler deploy --config apps/cloud/wrangler.toml
 *
 * See `apps/cloud/wrangler.toml` for the full deployment workflow
 * (build + push image, then deploy Worker).
 */

import { Container, getContainer } from '@cloudflare/containers';

export interface Env {
    CLOUD: DurableObjectNamespace<CloudContainer>;
}

/**
 * Durable Object class that owns a single Cloud container instance.
 * The control plane is long-lived and stateful, but all persistent state
 * is offloaded to Turso (libSQL) — the container itself is replaceable.
 * We pin to a single Durable Object id so all requests share one process.
 */
export class CloudContainer extends Container {
    defaultPort = 4000;
    sleepAfter = '30m';
    enableInternet = true;
    requiredPorts = [4000];
    envVars = {
        NODE_ENV: 'production',
        OS_MODE: 'cloud',
        PORT: '4000',
        HOST: '0.0.0.0',
        OS_DISABLE_CONSOLE: '1',
        OS_KERNEL_CACHE_SIZE: '50',
        OS_KERNEL_TTL_MS: '1800000',
        OS_ENV_CACHE_TTL_MS: '300000',
    };
}

export default {
    async fetch(request: Request, env: Env): Promise<Response> {
        const container = getContainer(env.CLOUD, 'singleton');
        return container.fetch(request);
    },
};
