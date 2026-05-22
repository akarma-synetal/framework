// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { MetricsRegistry, MetricSample } from './contracts.js';

// ─── Noop ─────────────────────────────────────────────────────────────

/**
 * No-op metrics registry — the default. Discards every observation.
 * Production deployments should swap this for a real registry; tests
 * can use {@link InMemoryMetricsRegistry} to assert emissions.
 */
export class NoopMetricsRegistry implements MetricsRegistry {
    counter(): void { }
    histogram(): void { }
    gauge(): void { }
}

// ─── In-memory (tests + dev inspection) ───────────────────────────────

/**
 * In-memory registry used for tests and local inspection. Stores
 * every observation in insertion order; query via the helpers below
 * or read {@link samples} directly.
 *
 * Not intended for production — unbounded growth.
 */
export class InMemoryMetricsRegistry implements MetricsRegistry {
    readonly samples: MetricSample[] = [];

    counter(name: string, labels: Record<string, string> = {}, value: number = 1): void {
        this.samples.push({ name, kind: 'counter', value, labels, at: Date.now() });
    }

    histogram(name: string, value: number, labels: Record<string, string> = {}): void {
        this.samples.push({ name, kind: 'histogram', value, labels, at: Date.now() });
    }

    gauge(name: string, value: number, labels: Record<string, string> = {}): void {
        this.samples.push({ name, kind: 'gauge', value, labels, at: Date.now() });
    }

    /** Sum of counter increments matching `name` and optionally a label subset. */
    totalCounter(name: string, labelMatch: Record<string, string> = {}): number {
        return this.samples
            .filter(s => s.kind === 'counter' && s.name === name && matchesLabels(s.labels, labelMatch))
            .reduce((acc, s) => acc + s.value, 0);
    }

    /** Raw histogram observations matching `name` and optionally a label subset. */
    histogramValues(name: string, labelMatch: Record<string, string> = {}): number[] {
        return this.samples
            .filter(s => s.kind === 'histogram' && s.name === name && matchesLabels(s.labels, labelMatch))
            .map(s => s.value);
    }

    /** Last gauge value matching `name` and optionally a label subset, or undefined. */
    lastGauge(name: string, labelMatch: Record<string, string> = {}): number | undefined {
        for (let i = this.samples.length - 1; i >= 0; i--) {
            const s = this.samples[i];
            if (s.kind === 'gauge' && s.name === name && matchesLabels(s.labels, labelMatch)) {
                return s.value;
            }
        }
        return undefined;
    }

    /** Clear all recorded samples. */
    reset(): void {
        this.samples.length = 0;
    }
}

function matchesLabels(actual: Record<string, string>, expected: Record<string, string>): boolean {
    for (const [k, v] of Object.entries(expected)) {
        if (actual[k] !== v) return false;
    }
    return true;
}

// ─── Console (development) ────────────────────────────────────────────

/**
 * Console metrics registry — prints one line per observation. Useful
 * during local development to confirm that instrumentation is firing.
 *
 * Not intended for production: writing every observation to stdout
 * defeats Prometheus / OTLP pipelines and dominates request latency.
 */
export class ConsoleMetricsRegistry implements MetricsRegistry {
    constructor(private readonly opts: { sink?: (line: string) => void; prefix?: string } = {}) { }

    counter(name: string, labels: Record<string, string> = {}, value: number = 1): void {
        this.emit('counter', name, value, labels);
    }
    histogram(name: string, value: number, labels: Record<string, string> = {}): void {
        this.emit('histogram', name, value, labels);
    }
    gauge(name: string, value: number, labels: Record<string, string> = {}): void {
        this.emit('gauge', name, value, labels);
    }

    private emit(kind: string, name: string, value: number, labels: Record<string, string>): void {
        try {
            const sink = this.opts.sink ?? ((s) => { console.log(s); });
            const prefix = this.opts.prefix ?? '[metric]';
            const labelStr = Object.entries(labels)
                .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
                .join(' ');
            sink(`${prefix} ${kind} ${name} ${value}${labelStr ? ' ' + labelStr : ''}`);
        } catch {
            // Per contract: never throw from a metric call site.
        }
    }
}

// ─── OTLP / HTTP (Prometheus via OTel Collector, Grafana Cloud, …) ────

/**
 * Configuration for {@link OtlpHttpMetricsRegistry}.
 */
export interface OtlpHttpExporterOptions {
    /**
     * OTLP/HTTP metrics endpoint, e.g. `http://otel-collector:4318/v1/metrics`.
     * The path is appended automatically if missing.
     */
    endpoint: string;

    /** Optional headers (Authorization, x-tenant, …). */
    headers?: Record<string, string>;

    /**
     * Resource attributes — `service.name`, `service.namespace`,
     * `deployment.environment`, etc. Merged into the OTLP `resource`
     * block on every export.
     */
    resource?: Record<string, string>;

    /**
     * Custom fetch implementation. Defaults to the global `fetch`.
     * Allows Workers / undici / node-fetch substitution and test
     * doubles.
     */
    fetch?: typeof fetch;

    /**
     * Called when an export attempt fails. Default: silently swallow
     * (per the contract that metric emission must not throw / log
     * loudly on the hot path).
     */
    onError?: (error: unknown) => void;

    /**
     * Maximum number of samples buffered before {@link OtlpHttpMetricsRegistry.flush}
     * is called automatically. Defaults to 1024.
     */
    maxBufferSize?: number;
}

/**
 * OTLP/HTTP metrics exporter.
 *
 * Buffers samples in memory and serialises them to the OpenTelemetry
 * Protocol JSON encoding when {@link flush} is called (manually or
 * automatically once the buffer hits the configured size).
 *
 * Intentionally does **not** start an interval timer in the constructor:
 * (a) it makes the exporter usable on Cloudflare Workers where
 * `setInterval` is restricted, and (b) it keeps unit tests deterministic.
 * Long-running hosts should call `flush()` on a schedule
 * (e.g. `setInterval(() => reg.flush(), 10_000)` on Node, or
 * `ctx.waitUntil(reg.flush())` from a Workers fetch handler).
 *
 * Only counters, histograms, and gauges are emitted — no support for
 * exemplars or aggregation temporality switches (the Collector handles
 * those on the upstream side).
 */
export class OtlpHttpMetricsRegistry implements MetricsRegistry {
    private buffer: MetricSample[] = [];
    private readonly endpoint: string;
    private readonly headers: Record<string, string>;
    private readonly resource: Record<string, string>;
    private readonly maxBufferSize: number;
    private readonly fetchImpl: typeof fetch;
    private readonly onError: (error: unknown) => void;

    constructor(options: OtlpHttpExporterOptions) {
        this.endpoint = normaliseEndpoint(options.endpoint);
        this.headers = options.headers ?? {};
        this.resource = options.resource ?? {};
        this.maxBufferSize = options.maxBufferSize ?? 1024;
        this.fetchImpl = options.fetch ?? (typeof fetch !== 'undefined' ? fetch.bind(globalThis) : noFetch);
        this.onError = options.onError ?? (() => { });
    }

    counter(name: string, labels: Record<string, string> = {}, value: number = 1): void {
        this.record({ name, kind: 'counter', value, labels, at: Date.now() });
    }
    histogram(name: string, value: number, labels: Record<string, string> = {}): void {
        this.record({ name, kind: 'histogram', value, labels, at: Date.now() });
    }
    gauge(name: string, value: number, labels: Record<string, string> = {}): void {
        this.record({ name, kind: 'gauge', value, labels, at: Date.now() });
    }

    private record(sample: MetricSample): void {
        this.buffer.push(sample);
        if (this.buffer.length >= this.maxBufferSize) {
            // Fire-and-forget: do not block the call site.
            void this.flush().catch(this.onError);
        }
    }

    /** Snapshot the current buffer (for tests). */
    peek(): readonly MetricSample[] {
        return this.buffer.slice();
    }

    /**
     * Send the buffered samples to the OTLP endpoint and clear the
     * buffer. Safe to call concurrently — each invocation takes a
     * snapshot before clearing.
     */
    async flush(): Promise<void> {
        if (this.buffer.length === 0) return;
        const samples = this.buffer;
        this.buffer = [];
        try {
            const body = JSON.stringify(serialiseToOtlp(samples, this.resource));
            const res = await this.fetchImpl(this.endpoint, {
                method: 'POST',
                headers: { 'content-type': 'application/json', ...this.headers },
                body,
            });
            if (!res.ok) {
                this.onError(new Error(`OTLP export returned HTTP ${res.status}`));
            }
        } catch (err) {
            this.onError(err);
        }
    }
}

function normaliseEndpoint(raw: string): string {
    const trimmed = raw.replace(/\/+$/, '');
    if (/\/v1\/metrics$/.test(trimmed)) return trimmed;
    return trimmed + '/v1/metrics';
}

function noFetch(): never {
    throw new Error('OtlpHttpMetricsRegistry: no global fetch available; pass options.fetch');
}

/**
 * Minimal OTLP/JSON metrics serialiser.
 *
 * Implements the subset of <https://opentelemetry.io/docs/specs/otlp/>
 * that we actually emit — sums for counters, gauges for gauges,
 * histograms encoded as bucketless "summary"-style histograms with
 * explicit per-sample data points. The Collector accepts this shape
 * and applies its own bucketing.
 *
 * Aggregation temporality is set to DELTA (2) because every flush
 * sends only the samples accumulated since the last flush.
 */
function serialiseToOtlp(samples: MetricSample[], resource: Record<string, string>): unknown {
    const byName = new Map<string, { kind: MetricSample['kind']; points: MetricSample[] }>();
    for (const s of samples) {
        const existing = byName.get(s.name);
        if (existing) existing.points.push(s);
        else byName.set(s.name, { kind: s.kind, points: [s] });
    }

    const metrics = Array.from(byName.entries()).map(([name, { kind, points }]) => {
        if (kind === 'counter') {
            return {
                name,
                sum: {
                    dataPoints: points.map(p => toNumberPoint(p)),
                    aggregationTemporality: 2,
                    isMonotonic: true,
                },
            };
        }
        if (kind === 'gauge') {
            return { name, gauge: { dataPoints: points.map(p => toNumberPoint(p)) } };
        }
        // histogram: emit a histogram with a single bucket boundary so the
        // Collector treats it as a recorded distribution.
        return {
            name,
            histogram: {
                aggregationTemporality: 2,
                dataPoints: points.map(p => ({
                    attributes: toAttributes(p.labels),
                    timeUnixNano: String(p.at) + '000000',
                    startTimeUnixNano: String(p.at) + '000000',
                    count: '1',
                    sum: p.value,
                    bucketCounts: ['0', '1'],
                    explicitBounds: [p.value],
                })),
            },
        };
    });

    return {
        resourceMetrics: [{
            resource: { attributes: toAttributes(resource) },
            scopeMetrics: [{
                scope: { name: '@objectstack/observability', version: '0.1.0' },
                metrics,
            }],
        }],
    };
}

function toNumberPoint(p: MetricSample): unknown {
    return {
        attributes: toAttributes(p.labels),
        timeUnixNano: String(p.at) + '000000',
        startTimeUnixNano: String(p.at) + '000000',
        asDouble: p.value,
    };
}

function toAttributes(labels: Record<string, string>): unknown[] {
    return Object.entries(labels).map(([key, value]) => ({
        key,
        value: { stringValue: value },
    }));
}
