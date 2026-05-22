// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { ErrorReporter, CapturedError } from './contracts.js';

/** No-op reporter — the default. */
export class NoopErrorReporter implements ErrorReporter {
    captureException(): void { }
}

/** In-memory reporter for tests. */
export class InMemoryErrorReporter implements ErrorReporter {
    readonly captured: CapturedError[] = [];

    captureException(error: unknown, context: Record<string, unknown> = {}): void {
        this.captured.push({ error, context, at: Date.now() });
    }

    reset(): void {
        this.captured.length = 0;
    }
}

/**
 * Console error reporter — writes a structured JSON line to stderr per
 * captured exception. Convenient default for local development and for
 * any deployment that ships stderr to a log aggregator (e.g. Loki,
 * fluent-bit) but does not have a dedicated APM.
 *
 * Stack traces are included when the captured value is an `Error`.
 */
export class ConsoleErrorReporter implements ErrorReporter {
    constructor(private readonly opts: { sink?: (line: string) => void } = {}) { }

    captureException(error: unknown, context: Record<string, unknown> = {}): void {
        try {
            const sink = this.opts.sink ?? ((s) => { console.error(s); });
            const record: Record<string, unknown> = {
                ts: new Date().toISOString(),
                level: 'error',
                msg: error instanceof Error ? error.message : String(error),
                context,
            };
            if (error instanceof Error && error.stack) {
                record.stack = error.stack;
            }
            sink(JSON.stringify(record));
        } catch {
            // Per contract: error reporting must never throw.
        }
    }
}
