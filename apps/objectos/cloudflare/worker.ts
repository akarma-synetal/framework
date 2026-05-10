// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Cloudflare Containers entrypoint for ObjectOS.
 *
 * The Worker fronts a Container-class Durable Object that runs the
 * Node.js image built from `apps/objectos/Dockerfile`. All HTTP traffic
 * is forwarded 1:1 to the container on port 3000.
 *
 * Deploy with:
 *   wrangler deploy --config apps/objectos/wrangler.toml
 *
 * See `apps/objectos/wrangler.toml` for the full deployment workflow
 * (build + push image, then deploy Worker).
 */

import { Container, getContainer } from '@cloudflare/containers';

export interface Env {
    OBJECTOS: DurableObjectNamespace<ObjectOSContainer>;
}

/**
 * Durable Object class that owns a single ObjectOS container instance.
 * Cloudflare routes traffic to a specific instance by Durable Object id;
 * we use a single shared id so all requests hit the same long-lived
 * Node.js process (control-plane state lives in Turso, not the
 * container's filesystem, so this is safe and cheap).
 */
export class ObjectOSContainer extends Container {
    defaultPort = 3000;
    sleepAfter = '15m';
    enableInternet = true;
    requiredPorts = [3000];
    envVars = {
        NODE_ENV: 'production',
        PORT: '3000',
        HOST: '0.0.0.0',
        OS_KERNEL_CACHE_SIZE: '50',
        OS_KERNEL_TTL_MS: '1800000',
        OS_ENV_CACHE_TTL_MS: '300000',
    };
}

export default {
    async fetch(request: Request, env: Env): Promise<Response> {
        const container = getContainer(env.OBJECTOS, 'singleton');
        return container.fetch(request);
    },
};
