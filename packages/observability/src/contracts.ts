// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Observability contracts for ObjectStack.
 *
 * Three orthogonal concerns live here:
 *
 *   - **MetricsRegistry** — counters / histograms / gauges, Prometheus-style names.
 *   - **ErrorReporter** — APM-style exception capture (Sentry / Datadog / Rollbar).
 *   - **Logger** — structured log records (re-exported from `@objectstack/spec`).
 *
 * Implementations of these contracts live in this same package
 * (see `metrics-exporters.ts`, `error-exporters.ts`, `loggers.ts`). The
 * runtime, services, and host applications only depend on the contracts
 * so any backend can be wired at deployment time.
 */

// ─── Metrics ──────────────────────────────────────────────────────────

/**
 * Metrics registry contract.
 *
 * Hosts plug in whatever metrics backend they want (Prometheus via
 * `prom-client`, OTel via `@opentelemetry/api-metrics`, Cloudflare
 * Workers Analytics Engine, StatsD, CloudWatch, …) without the
 * framework taking a hard dep on any of them.
 *
 * Naming follows Prometheus conventions:
 *
 *   - snake_case names
 *   - unit suffix (`_ms`, `_seconds`, `_bytes`, `_total` for counters)
 *
 * Labels are arbitrary string maps; backends should map them to their
 * native label/tag concept. **Keep cardinality low** — never label by
 * raw url path, user id, or tenant id without bucketing.
 *
 * All methods are fire-and-forget; implementations MUST NOT throw on
 * the hot path. Use `NoopMetricsRegistry` when metrics are disabled.
 */
export interface MetricsRegistry {
    /** Monotonic counter. `value` defaults to 1. */
    counter(name: string, labels?: Record<string, string>, value?: number): void;

    /** Histogram / timing in arbitrary units (typically ms). */
    histogram(name: string, value: number, labels?: Record<string, string>): void;

    /** Point-in-time gauge. */
    gauge(name: string, value: number, labels?: Record<string, string>): void;
}

/** Recorded metric sample (used by InMemoryMetricsRegistry and OTLP exporter). */
export interface MetricSample {
    name: string;
    kind: 'counter' | 'histogram' | 'gauge';
    value: number;
    labels: Record<string, string>;
    /** Wall-clock timestamp (ms epoch). */
    at: number;
}

// ─── Errors ───────────────────────────────────────────────────────────

/**
 * Error reporter contract.
 *
 * Production deployments wire this to Sentry, Datadog APM, Rollbar,
 * etc. The runtime calls `captureException` when a route handler
 * results in a 5xx response so the host's APM gets the stack trace
 * without each plugin/route needing to import the vendor SDK.
 *
 * Implementations MUST NOT throw — error reporting failures should be
 * swallowed so the original error reaches the client unmolested.
 *
 * 4xx responses are intentionally NOT captured here. Client errors
 * flood APM systems with noise. Use metrics counters
 * (`http_requests_total{status="4xx"}`) for them, not error reporting.
 */
export interface ErrorReporter {
    /**
     * Capture a thrown error with optional context. Context typically
     * includes `requestId`, `method`, `route`, `userId`, `orgId`.
     *
     * The reporter is responsible for redacting sensitive fields from
     * `context` (the runtime does not know what is sensitive in the
     * caller's deployment).
     */
    captureException(error: unknown, context?: Record<string, unknown>): void;
}

/** Recorded error (used by InMemoryErrorReporter). */
export interface CapturedError {
    error: unknown;
    context: Record<string, unknown>;
    at: number;
}

// ─── Logger ───────────────────────────────────────────────────────────

/**
 * Re-export the canonical Logger contract from `@objectstack/spec` so
 * downstream code can import metrics, errors, and logs from one place
 * without straddling two packages.
 */
export type { Logger } from '@objectstack/spec/contracts';
