// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { defineView } from '@objectstack/spec';

/**
 * ai_traces — built-in Studio list view.
 *
 * Exposes per-call observability for every LLM invocation that flowed
 * through the `AIService`. Ships with the platform so users don't have
 * to author a view for an object they didn't create.
 *
 * - Default list: grid sorted by `created_at` desc, showing the columns an
 *   operator usually wants at a glance (operation, model, latency, tokens,
 *   cost, status).
 * - `errors` view: pre-filtered to status="error" for triage.
 * - `by_model` view: grouped by model for cost / quality comparison.
 *
 * Registered via the AIService plugin's manifest payload — appears
 * automatically in Studio when AIService is loaded.
 */
export const AiTraceView = defineView({
  list: {
    type: 'grid',
    data: { provider: 'object', object: 'ai_traces' },
    columns: [
      { field: 'created_at', label: 'Time' },
      { field: 'operation' },
      { field: 'model' },
      { field: 'agent_id', label: 'Agent' },
      { field: 'latency_ms', label: 'Latency (ms)' },
      { field: 'total_tokens', label: 'Tokens' },
      { field: 'cost_total', label: 'Cost' },
      { field: 'status' },
    ],
    sort: [{ field: 'created_at', order: 'desc' }],
    pagination: { pageSize: 50 },
    searchableFields: ['conversation_id', 'agent_id', 'model', 'error'],
    filterableFields: ['operation', 'model', 'status'],
  },
  listViews: {
    errors: {
      label: 'Errors',
      type: 'grid',
      data: { provider: 'object', object: 'ai_traces' },
      columns: [
        { field: 'created_at', label: 'Time' },
        { field: 'operation' },
        { field: 'model' },
        { field: 'latency_ms', label: 'Latency (ms)' },
        { field: 'error' },
      ],
      filter: [
        { field: 'status', operator: '=', value: 'error' },
      ],
      sort: [{ field: 'created_at', order: 'desc' }],
    },
    by_model: {
      label: 'By Model',
      type: 'grid',
      data: { provider: 'object', object: 'ai_traces' },
      columns: [
        { field: 'model' },
        { field: 'operation' },
        { field: 'latency_ms', label: 'Latency (ms)' },
        { field: 'total_tokens', label: 'Tokens' },
        { field: 'cost_total', label: 'Cost' },
        { field: 'status' },
        { field: 'created_at', label: 'Time' },
      ],
      grouping: { fields: [{ field: 'model' }] },
      sort: [{ field: 'created_at', order: 'desc' }],
    },
  },
});
