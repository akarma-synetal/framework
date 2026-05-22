// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { Logger } from './contracts.js';

/** Recognised log levels in increasing severity order. */
export const LOG_LEVELS = ['debug', 'info', 'warn', 'error', 'fatal'] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];

const LEVEL_PRIORITY: Record<LogLevel, number> = {
    debug: 10,
    info: 20,
    warn: 30,
    error: 40,
    fatal: 50,
};

/** No-op logger — discards every message. */
export class NoopLogger implements Logger {
    debug(): void { }
    info(): void { }
    warn(): void { }
    error(): void { }
    fatal(): void { }
    child(): Logger { return this; }
}

/**
 * Console logger — pretty-printed messages for local development.
 *
 * Not suitable for production where structured JSON is required;
 * use {@link JsonLogger} there instead.
 */
export class ConsoleLogger implements Logger {
    constructor(
        private readonly opts: {
            level?: LogLevel;
            context?: Record<string, unknown>;
            sink?: { log: (s: string) => void; error: (s: string) => void };
        } = {},
    ) { }

    private get threshold(): number {
        return LEVEL_PRIORITY[this.opts.level ?? 'info'];
    }
    private get sink() {
        return this.opts.sink ?? { log: (s: string) => console.log(s), error: (s: string) => console.error(s) };
    }
    private get context(): Record<string, unknown> {
        return this.opts.context ?? {};
    }

    debug(message: string, meta?: Record<string, unknown>): void { this.emit('debug', message, meta); }
    info(message: string, meta?: Record<string, unknown>): void { this.emit('info', message, meta); }
    warn(message: string, meta?: Record<string, unknown>): void { this.emit('warn', message, meta); }
    error(message: string, error?: Error, meta?: Record<string, unknown>): void {
        this.emit('error', message, { ...(meta ?? {}), ...(error ? { error: error.message, stack: error.stack } : {}) });
    }
    fatal(message: string, error?: Error, meta?: Record<string, unknown>): void {
        this.emit('fatal', message, { ...(meta ?? {}), ...(error ? { error: error.message, stack: error.stack } : {}) });
    }
    child(context: Record<string, unknown>): Logger {
        return new ConsoleLogger({ ...this.opts, context: { ...this.context, ...context } });
    }

    private emit(level: LogLevel, msg: string, meta?: Record<string, unknown>): void {
        if (LEVEL_PRIORITY[level] < this.threshold) return;
        try {
            const merged = { ...this.context, ...(meta ?? {}) };
            const tail = Object.keys(merged).length ? ' ' + JSON.stringify(merged) : '';
            const line = `[${level}] ${msg}${tail}`;
            if (level === 'error' || level === 'fatal') this.sink.error(line);
            else this.sink.log(line);
        } catch {
            // Log emission must never throw.
        }
    }
}

/**
 * JSON logger — one JSON object per line on stdout (errors on stderr).
 *
 * Matches the shape that Loki / fluent-bit / Cloudflare Logpush ingest
 * by default. Every record contains `ts`, `level`, `msg`, and any
 * accumulated child-context plus per-call `meta`.
 *
 * Use this in production. Use {@link ConsoleLogger} during development
 * for human-friendly output.
 */
export class JsonLogger implements Logger {
    constructor(
        private readonly opts: {
            level?: LogLevel;
            context?: Record<string, unknown>;
            sink?: { log: (s: string) => void; error: (s: string) => void };
            /** Optional fields injected into every record (`service`, `env`, …). */
            base?: Record<string, unknown>;
            /** Wall clock for tests. */
            now?: () => Date;
        } = {},
    ) { }

    private get threshold(): number { return LEVEL_PRIORITY[this.opts.level ?? 'info']; }
    private get sink() {
        return this.opts.sink ?? { log: (s: string) => console.log(s), error: (s: string) => console.error(s) };
    }
    private get context(): Record<string, unknown> { return this.opts.context ?? {}; }
    private get base(): Record<string, unknown> { return this.opts.base ?? {}; }
    private get now(): () => Date { return this.opts.now ?? (() => new Date()); }

    debug(message: string, meta?: Record<string, unknown>): void { this.emit('debug', message, meta); }
    info(message: string, meta?: Record<string, unknown>): void { this.emit('info', message, meta); }
    warn(message: string, meta?: Record<string, unknown>): void { this.emit('warn', message, meta); }
    error(message: string, error?: Error, meta?: Record<string, unknown>): void {
        this.emit('error', message, { ...(meta ?? {}), ...(error ? { error: error.message, stack: error.stack } : {}) });
    }
    fatal(message: string, error?: Error, meta?: Record<string, unknown>): void {
        this.emit('fatal', message, { ...(meta ?? {}), ...(error ? { error: error.message, stack: error.stack } : {}) });
    }
    child(context: Record<string, unknown>): Logger {
        return new JsonLogger({ ...this.opts, context: { ...this.context, ...context } });
    }

    private emit(level: LogLevel, msg: string, meta?: Record<string, unknown>): void {
        if (LEVEL_PRIORITY[level] < this.threshold) return;
        try {
            const record = {
                ts: this.now().toISOString(),
                level,
                msg,
                ...this.base,
                ...this.context,
                ...(meta ?? {}),
            };
            const line = JSON.stringify(record);
            if (level === 'error' || level === 'fatal') this.sink.error(line);
            else this.sink.log(line);
        } catch {
            // Log emission must never throw.
        }
    }
}
