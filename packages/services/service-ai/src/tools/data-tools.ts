// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type {
  AIToolDefinition,
  IDataEngine,
  IMetadataService,
} from '@objectstack/spec/contracts';
import type { ExecutionContext } from '@objectstack/spec/kernel';
import type { ToolHandler, ToolExecutionContext } from './tool-registry.js';
import type { ToolRegistry } from './tool-registry.js';

// ---------------------------------------------------------------------------
// Data context — injected once at registration time
// ---------------------------------------------------------------------------

/**
 * Services required by the built-in data tools.
 *
 * These are provided by the kernel at `ai:ready` time and closed over
 * by the handler functions so they stay framework-agnostic.
 *
 * `metadataService` and `protocol` are optional — when present they
 * enable runtime field-existence validation on `where` / `fields` /
 * `orderBy` / `groupBy` / `aggregations`, so the agent gets a structured
 * error pointing to `describe_object` instead of silently returning an
 * empty result set when it hallucinates a field name. When neither is
 * wired (legacy callers, edge runtimes without metadata), validation is
 * skipped and the tools behave as before.
 */
export interface DataToolContext {
  /** ObjectQL data engine for record-level operations. */
  dataEngine: IDataEngine;
  /** Optional metadata service for object schema lookup. */
  metadataService?: IMetadataService;
  /**
   * Optional protocol service for cross-source metadata enumeration —
   * needed to validate fields on system objects that live in
   * ObjectQL's SchemaRegistry rather than the MetadataManager
   * (e.g. `sys_user` from plugin-auth). Mirrors the fallback used by
   * `describe_object` / `list_objects` in metadata-tools.
   */
  protocol?: {
    getMetaItems(request: { type: string; packageId?: string; organizationId?: string }): Promise<unknown[]>;
  };
}

/**
 * Translate a {@link ToolExecutionContext} into the ObjectQL
 * {@link ExecutionContext} that data-engine calls expect.
 *
 * When the AI tool call carries an authenticated `actor`, we forward
 * the user/roles/permissions and explicitly set `isSystem: false` so
 * row-level security and field masking kick in just like they would
 * for a normal REST request.
 *
 * When no actor is supplied (legacy callers, cron jobs, plugin-level
 * bootstraps) we send `isSystem: true` to preserve today's
 * unrestricted behaviour — closing the agent-permission gap is
 * opt-in at the call site that knows the user.
 */
function buildEngineContext(ctx?: ToolExecutionContext): ExecutionContext {
  if (ctx?.actor) {
    return {
      userId: ctx.actor.id,
      roles: ctx.actor.roles ?? [],
      permissions: ctx.actor.permissions ?? [],
      isSystem: false,
      ...(ctx.environmentId ? { tenantId: ctx.environmentId } : {}),
      ...(ctx.traceId ? { traceId: ctx.traceId } : {}),
    };
  }
  return { roles: [], permissions: [], isSystem: true };
}

// ---------------------------------------------------------------------------
// Tool Definitions
// ---------------------------------------------------------------------------

/** Maximum number of records a single query may return. */
const MAX_QUERY_LIMIT = 200;

/** Default record limit when not specified. */
const DEFAULT_QUERY_LIMIT = 20;

export const QUERY_RECORDS_TOOL: AIToolDefinition = {
  name: 'query_records',
  label: 'Query Records',
  description:
    'Query records from a data object with optional filters, field selection, ' +
    'sorting, and pagination. Returns an array of matching records.',
  parameters: {
    type: 'object',
    properties: {
      objectName: {
        type: 'string',
        description: 'The snake_case name of the object to query',
      },
      where: {
        type: 'object',
        description:
          'Filter conditions. Keys MUST be real field names obtained from ' +
          'describe_object — do NOT assume generic fields like `status`, ' +
          '`is_active`, or `deleted_at` exist on every object. ' +
          'Values are equality matches, or MongoDB-style operators ' +
          '(`{ "$gt": 100 }`, `{ "$in": [...] }`, etc.). ' +
          'Logical combinators: `$and` / `$or` / `$not` with nested clauses.',
      },
      fields: {
        type: 'array',
        items: { type: 'string' },
        description: 'List of field names to return (omit for all fields)',
      },
      orderBy: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            field: { type: 'string' },
            order: { type: 'string', enum: ['asc', 'desc'] },
          },
          required: ['field', 'order'],
          additionalProperties: false,
        },
        description: 'Sort order (e.g. [{ "field": "created_at", "order": "desc" }])',
      },
      limit: {
        type: 'number',
        description: `Maximum number of records to return (default ${DEFAULT_QUERY_LIMIT}, max ${MAX_QUERY_LIMIT})`,
      },
      offset: {
        type: 'number',
        description: 'Number of records to skip for pagination',
      },
    },
    required: ['objectName'],
    additionalProperties: false,
  },
};

export const GET_RECORD_TOOL: AIToolDefinition = {
  name: 'get_record',
  label: 'Get Record',
  description: 'Get a single record by its ID from a data object.',
  parameters: {
    type: 'object',
    properties: {
      objectName: {
        type: 'string',
        description: 'The snake_case name of the object',
      },
      recordId: {
        type: 'string',
        description: 'The unique ID of the record',
      },
      fields: {
        type: 'array',
        items: { type: 'string' },
        description: 'List of field names to return (omit for all fields)',
      },
    },
    required: ['objectName', 'recordId'],
    additionalProperties: false,
  },
};

export const AGGREGATE_DATA_TOOL: AIToolDefinition = {
  name: 'aggregate_data',
  label: 'Aggregate Data',
  description:
    'Perform aggregation/statistical operations on a data object. ' +
    'Supports count, sum, avg, min, max with optional groupBy and where filters.',
  parameters: {
    type: 'object',
    properties: {
      objectName: {
        type: 'string',
        description: 'The snake_case name of the object to aggregate',
      },
      aggregations: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            function: {
              type: 'string',
              enum: ['count', 'sum', 'avg', 'min', 'max', 'count_distinct'],
              description: 'Aggregation function',
            },
            field: {
              type: 'string',
              description: 'Field to aggregate (optional for count)',
            },
            alias: {
              type: 'string',
              description: 'Result column alias',
            },
          },
          required: ['function', 'alias'],
          additionalProperties: false,
        },
        description: 'Aggregation definitions',
      },
      groupBy: {
        type: 'array',
        items: { type: 'string' },
        description: 'Fields to group by',
      },
      where: {
        type: 'object',
        description:
          'Filter applied before aggregation. Same rules as query_records: ' +
          'keys MUST be real field names obtained from describe_object — ' +
          'do NOT guess generic fields like `status` or `is_active`.',
      },
    },
    required: ['objectName', 'aggregations'],
    additionalProperties: false,
  },
};

/** All built-in data tools definitions. */
export const DATA_TOOL_DEFINITIONS: AIToolDefinition[] = [
  QUERY_RECORDS_TOOL,
  GET_RECORD_TOOL,
  AGGREGATE_DATA_TOOL,
];

// ---------------------------------------------------------------------------
// Field-existence validation — closes the hallucination loop
// ---------------------------------------------------------------------------

/** Minimal object-definition shape used for field lookup. */
interface FieldLookupObjectDef {
  name?: string;
  fields?: Record<string, { type?: string } | unknown>;
}

/**
 * Resolve the set of valid field names for an object, mirroring the
 * dual-source lookup used by `describe_object` in metadata-tools.
 *
 * Returns `null` when no metadata source is wired or the object can't
 * be found — callers MUST treat null as "skip validation" so legacy
 * deployments that don't pass `metadataService` keep working.
 */
async function resolveObjectFieldNames(
  ctx: DataToolContext,
  objectName: string,
): Promise<Set<string> | null> {
  let def: unknown | undefined;
  if (ctx.metadataService) {
    try {
      def = await ctx.metadataService.getObject(objectName);
    } catch {
      def = undefined;
    }
  }
  if (!def && ctx.protocol?.getMetaItems) {
    try {
      const all = await ctx.protocol.getMetaItems({ type: 'object' });
      const arr: FieldLookupObjectDef[] = Array.isArray(all)
        ? (all as FieldLookupObjectDef[])
        : (all && typeof all === 'object' && Array.isArray((all as { items?: unknown }).items)
          ? ((all as { items: FieldLookupObjectDef[] }).items)
          : []);
      def = arr.find(o => o?.name === objectName);
    } catch {
      def = undefined;
    }
  }
  if (!def) return null;
  const fields = (def as FieldLookupObjectDef).fields ?? {};
  // Always allow `id` even if the object def hides it — it's the
  // universal primary key and the data engine always honours it.
  const names = new Set<string>(['id', ...Object.keys(fields)]);
  return names;
}

/** Mongo-style operators that may appear as keys inside a `where` clause. */
const WHERE_OPERATOR_KEYS = new Set([
  '$and', '$or', '$not', '$nor',
  '$eq', '$ne', '$gt', '$gte', '$lt', '$lte',
  '$in', '$nin', '$exists', '$regex', '$like', '$ilike',
  '$contains', '$startsWith', '$endsWith', '$between',
]);

/**
 * Walk a `where` clause and collect every key that looks like a field
 * reference (i.e. is not an operator and not a numeric array index).
 */
function collectWhereFields(where: unknown, acc: Set<string>): void {
  if (!where || typeof where !== 'object') return;
  if (Array.isArray(where)) {
    for (const item of where) collectWhereFields(item, acc);
    return;
  }
  for (const [key, value] of Object.entries(where as Record<string, unknown>)) {
    if (WHERE_OPERATOR_KEYS.has(key)) {
      collectWhereFields(value, acc);
    } else {
      acc.add(key);
      // Nested operator object — recurse into its values to catch
      // `{ author: { name: ... } }` style nested-relation filters.
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        collectWhereFields(value, acc);
      }
    }
  }
}

/** Build a structured "unknown field" error pointing the agent at describe_object. */
function unknownFieldError(
  objectName: string,
  unknown: string[],
  available: Set<string>,
): string {
  // Cap the available-fields list so a 200-field object doesn't blow
  // the agent's context window. The full list is one describe_object
  // call away.
  const sample = [...available].slice(0, 40);
  const truncated = available.size > sample.length;
  return JSON.stringify({
    error:
      `Unknown field(s) ${JSON.stringify(unknown)} on "${objectName}". ` +
      `Call describe_object first to see the real schema — do not guess generic ` +
      `fields like \`status\`, \`is_active\`, or \`deleted_at\`.`,
    objectName,
    unknownFields: unknown,
    availableFields: sample,
    availableFieldsTruncated: truncated,
    totalAvailable: available.size,
    hint: 'Use the describe_object tool to fetch the authoritative field list.',
  });
}

/**
 * Validate that every field referenced in `where` / `fields` / `orderBy`
 * / `groupBy` / aggregation `field` exists on the object. Returns the
 * JSON error string when validation fails, or `null` to proceed.
 */
async function validateFieldReferences(
  ctx: DataToolContext,
  objectName: string,
  refs: {
    where?: unknown;
    fields?: string[];
    orderBy?: Array<{ field: string }>;
    groupBy?: string[];
    aggregations?: Array<{ field?: string }>;
  },
): Promise<string | null> {
  const available = await resolveObjectFieldNames(ctx, objectName);
  if (!available) return null; // metadata unavailable — skip validation

  const referenced = new Set<string>();
  collectWhereFields(refs.where, referenced);
  for (const f of refs.fields ?? []) referenced.add(f);
  for (const o of refs.orderBy ?? []) if (o?.field) referenced.add(o.field);
  for (const g of refs.groupBy ?? []) referenced.add(g);
  for (const a of refs.aggregations ?? []) {
    if (a?.field) referenced.add(a.field);
  }

  const unknown: string[] = [];
  for (const ref of referenced) {
    if (!available.has(ref)) unknown.push(ref);
  }
  if (unknown.length === 0) return null;
  return unknownFieldError(objectName, unknown, available);
}

// ---------------------------------------------------------------------------
// Handler Factories
// ---------------------------------------------------------------------------

function createQueryRecordsHandler(ctx: DataToolContext): ToolHandler {
  return async (args, execCtx) => {
    const {
      objectName,
      where,
      fields,
      orderBy,
      limit,
      offset,
    } = args as {
      objectName: string;
      where?: Record<string, unknown>;
      fields?: string[];
      orderBy?: Array<{ field: string; order: 'asc' | 'desc' }>;
      limit?: number;
      offset?: number;
    };

    // Field-existence guard — prevents the LLM from silently getting
    // an empty result set when it invents fields. Returns null when
    // metadata isn't wired so callers without it still work.
    const validationError = await validateFieldReferences(ctx, objectName, {
      where,
      fields,
      orderBy,
    });
    if (validationError) return validationError;

    // Validate and clamp limit to [1, MAX_QUERY_LIMIT]
    const rawLimit = limit ?? DEFAULT_QUERY_LIMIT;
    const safeLimit = Number.isFinite(rawLimit) && rawLimit > 0
      ? Math.min(Math.floor(rawLimit), MAX_QUERY_LIMIT)
      : DEFAULT_QUERY_LIMIT;

    // Validate offset: must be a non-negative finite integer
    const safeOffset = (Number.isFinite(offset) && (offset as number) >= 0)
      ? Math.floor(offset as number)
      : undefined;

    const records = await ctx.dataEngine.find(objectName, {
      where,
      fields,
      orderBy,
      limit: safeLimit,
      offset: safeOffset,
      context: buildEngineContext(execCtx),
    });

    return JSON.stringify({ count: records.length, records });
  };
}

function createGetRecordHandler(ctx: DataToolContext): ToolHandler {
  return async (args, execCtx) => {
    const { objectName, recordId, fields } = args as {
      objectName: string;
      recordId: string;
      fields?: string[];
    };

    // Field-projection guard.
    const validationError = await validateFieldReferences(ctx, objectName, { fields });
    if (validationError) return validationError;

    const record = await ctx.dataEngine.findOne(objectName, {
      where: { id: recordId },
      fields,
      context: buildEngineContext(execCtx),
    });

    if (!record) {
      return JSON.stringify({ error: `Record "${recordId}" not found in "${objectName}"` });
    }

    return JSON.stringify(record);
  };
}

/** Aggregation function names supported by the data engine. */
type AggFn = 'count' | 'sum' | 'avg' | 'min' | 'max' | 'count_distinct';

/** Set of valid aggregation function names for runtime validation. */
const VALID_AGG_FUNCTIONS = new Set<string>([
  'count', 'sum', 'avg', 'min', 'max', 'count_distinct',
]);

function createAggregateDataHandler(ctx: DataToolContext): ToolHandler {
  return async (args, execCtx) => {
    const { objectName, aggregations, groupBy, where } = args as {
      objectName: string;
      aggregations: Array<{ function: string; field?: string; alias: string }>;
      groupBy?: string[];
      where?: Record<string, unknown>;
    };

    // Validate aggregation functions at runtime
    for (const a of aggregations) {
      if (!VALID_AGG_FUNCTIONS.has(a.function)) {
        return JSON.stringify({
          error: `Invalid aggregation function "${a.function}". ` +
            `Allowed: ${[...VALID_AGG_FUNCTIONS].join(', ')}`,
        });
      }
    }

    // Field-existence guard — covers where filters, groupBy, and the
    // `field` of each aggregation. `count` without a field is allowed
    // (validateFieldReferences just won't see one).
    const validationError = await validateFieldReferences(ctx, objectName, {
      where,
      groupBy,
      aggregations,
    });
    if (validationError) return validationError;

    const result = await ctx.dataEngine.aggregate(objectName, {
      where,
      groupBy,
      aggregations: aggregations.map(a => ({
        function: a.function as AggFn,
        field: a.field,
        alias: a.alias,
      })),
      context: buildEngineContext(execCtx),
    });

    return JSON.stringify(result);
  };
}

// ---------------------------------------------------------------------------
// Public Registration Helper
// ---------------------------------------------------------------------------

/**
 * Register all built-in data tools on the given {@link ToolRegistry}.
 *
 * Typically called from the `ai:ready` hook after the data engine is available.
 *
 * @example
 * ```ts
 * ctx.hook('ai:ready', async (aiService) => {
 *   const dataEngine = ctx.getService<IDataEngine>('data');
 *   registerDataTools(aiService.toolRegistry, { dataEngine });
 * });
 * ```
 */
export function registerDataTools(
  registry: ToolRegistry,
  context: DataToolContext,
): void {
  registry.register(QUERY_RECORDS_TOOL, createQueryRecordsHandler(context));
  registry.register(GET_RECORD_TOOL, createGetRecordHandler(context));
  registry.register(AGGREGATE_DATA_TOOL, createAggregateDataHandler(context));
}
