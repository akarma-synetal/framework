// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Backwards-compat shim. See `metrics.ts` for the rationale — the
 * canonical home is `@objectstack/observability`.
 */
export {
    NoopErrorReporter,
    InMemoryErrorReporter,
    type ErrorReporter,
    type CapturedError,
} from '@objectstack/observability';
