// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Load-time metadata diagnostics.
 *
 * Decorates metadata documents read from `getMetaItems()` /
 * `getMetaItem()` with a `_diagnostics` envelope so Studio (and any
 * other consumer) can render validity badges, inline field errors, and
 * governance dashboards without having to re-implement spec validation
 * on the client.
 *
 * Single source of truth: the same {@link getMetadataTypeSchema} that
 * the save path (`protocol.saveMetaItem` →
 * `resolveOverlaySchema().safeParse()`) and the JSON-Schema emitter
 * (`getMetaTypes() → entries[].schema`) already consult. Adding a new
 * metadata type's Zod schema in one place automatically wires it up
 * for read-time diagnostics, write-time validation, **and** Studio's
 * form renderer.
 *
 * Wire shape (`_diagnostics`) intentionally mirrors the existing
 * {@link MetadataValidationResult} type from
 * `@objectstack/spec/kernel` so consumers can share one type alias
 * across the validate / write / read surfaces.
 */

import type { z } from 'zod';
import { getMetadataTypeSchema } from '@objectstack/spec/kernel';
import type { MetadataValidationResult } from '@objectstack/spec/kernel';
import { PLURAL_TO_SINGULAR } from '@objectstack/spec/shared';

/**
 * Re-export the canonical validation-result type so callers in this
 * package don't need to dual-import from `@objectstack/spec/kernel`.
 */
export type MetadataDiagnostics = MetadataValidationResult;

/**
 * Compute spec diagnostics for a single metadata document.
 *
 * Returns `undefined` when the type has no registered Zod schema
 * (`function` / `service` / `router`, or any plugin type that has not
 * called `registerMetadataTypeSchema()`). Callers MUST treat that as
 * "no opinion" — not as "valid" — and either skip decoration entirely
 * or surface a `validatable: false` flag if their UI cares.
 */
export function computeMetadataDiagnostics(
    type: string,
    item: unknown,
): MetadataDiagnostics | undefined {
    const singular = PLURAL_TO_SINGULAR[type] ?? type;
    const schema = getMetadataTypeSchema(singular);
    if (!schema) return undefined;

    if (item === null || item === undefined || typeof item !== 'object') {
        return {
            valid: false,
            errors: [{
                path: '',
                message: 'Metadata document must be a non-null object',
                code: 'invalid_type',
            }],
        };
    }

    // Strip our own decoration before re-validating so it never becomes
    // a false-positive "unrecognized_keys" failure on schemas that grow
    // a `.strict()` mode in the future.
    const candidate = '_diagnostics' in (item as Record<string, unknown>)
        ? stripDiagnostics(item as Record<string, unknown>)
        : item;

    const parsed = (schema as z.ZodTypeAny).safeParse(candidate);
    if (parsed.success) {
        return { valid: true };
    }

    const errors = parsed.error.issues.map((issue) => ({
        path: issue.path.map(String).join('.'),
        message: issue.message,
        code: issue.code as string,
    }));

    return { valid: false, errors };
}

function stripDiagnostics(item: Record<string, unknown>): Record<string, unknown> {
    const { _diagnostics: _drop, ...rest } = item;
    void _drop;
    return rest;
}

/**
 * Attach `_diagnostics` to a single metadata item. Returns the item
 * unchanged when no diagnostics could be computed (unknown type) or
 * when the input is not an object.
 *
 * The returned reference is always a shallow copy when decoration
 * occurs — callers must not assume identity equality with the input.
 */
export function decorateMetadataItem<T>(type: string, item: T): T {
    if (!item || typeof item !== 'object') return item;
    const diagnostics = computeMetadataDiagnostics(type, item);
    if (!diagnostics) return item;
    return { ...(item as Record<string, unknown>), _diagnostics: diagnostics } as T;
}

/**
 * Decorate an array of metadata items. Non-array inputs and non-object
 * elements are returned unchanged, preserving the upstream defensive
 * "items may be a wrapped or naked array" contract documented in
 * `rest-server.ts`.
 */
export function decorateMetadataItems<T>(type: string, items: T[]): T[] {
    if (!Array.isArray(items)) return items;
    return items.map((item) => decorateMetadataItem(type, item));
}
