// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect } from 'vitest';
import {
    InMemoryMetricsRegistry,
    InMemoryErrorReporter,
    NoopMetricsRegistry,
    NoopErrorReporter,
    OBSERVABILITY_METRICS_SERVICE,
    OBSERVABILITY_ERRORS_SERVICE,
} from '@objectstack/observability';
import { ObservabilityServicePlugin } from './observability-service-plugin';

/**
 * The plugin's only job is to register the host's metrics + error
 * backends under canonical service names so other plugins can resolve
 * them without each host threading config through every constructor.
 */

function makeCtx() {
    const services = new Map<string, any>();
    return {
        logger: { info: () => {}, warn: () => {}, error: () => {} },
        registerService: (name: string, svc: any) => { services.set(name, svc); },
        getService: <T>(name: string): T => {
            const s = services.get(name);
            if (!s) throw new Error(`service '${name}' not registered`);
            return s as T;
        },
        _services: services,
    } as any;
}

describe('ObservabilityServicePlugin', () => {
    it('registers explicit metrics + error backends under canonical names', async () => {
        const metrics = new InMemoryMetricsRegistry();
        const errors = new InMemoryErrorReporter();
        const ctx = makeCtx();

        await new ObservabilityServicePlugin({ metrics, errors }).init(ctx);

        expect(ctx._services.get(OBSERVABILITY_METRICS_SERVICE)).toBe(metrics);
        expect(ctx._services.get(OBSERVABILITY_ERRORS_SERVICE)).toBe(errors);
    });

    it('defaults to noop backends when no options provided', async () => {
        const ctx = makeCtx();
        await new ObservabilityServicePlugin().init(ctx);

        expect(ctx._services.get(OBSERVABILITY_METRICS_SERVICE)).toBeInstanceOf(NoopMetricsRegistry);
        expect(ctx._services.get(OBSERVABILITY_ERRORS_SERVICE)).toBeInstanceOf(NoopErrorReporter);
    });

    it('lets one backend be set while the other defaults to noop', async () => {
        const metrics = new InMemoryMetricsRegistry();
        const ctx = makeCtx();
        await new ObservabilityServicePlugin({ metrics }).init(ctx);

        expect(ctx._services.get(OBSERVABILITY_METRICS_SERVICE)).toBe(metrics);
        expect(ctx._services.get(OBSERVABILITY_ERRORS_SERVICE)).toBeInstanceOf(NoopErrorReporter);
    });
});
