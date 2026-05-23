// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Canonical service-registry names for the host's observability
 * backends. Plugins look these up to discover the configured
 * {@link MetricsRegistry} / {@link ErrorReporter} without each host
 * having to thread observability config through every plugin
 * constructor.
 *
 * See `@objectstack/runtime` → `ObservabilityServicePlugin` for the
 * registration side.
 */
export const OBSERVABILITY_METRICS_SERVICE = 'observability:metrics';
export const OBSERVABILITY_ERRORS_SERVICE = 'observability:errors';
