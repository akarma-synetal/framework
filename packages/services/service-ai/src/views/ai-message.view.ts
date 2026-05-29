// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { defineView } from '@objectstack/spec';

/**
 * ai_messages — built-in Studio analytics view.
 *
 * The conversation timeline itself is rendered by the AI Console chat UI,
 * not by this metadata. This view exists for **observability**: it shows
 * one row per message with token usage, latency, and model id so operators
 * can:
 *
 *  - audit cost per turn across all users / agents
 *  - spot latency regressions when changing models
 *  - compare two models head-to-head by filtering on `model`
 *  - drill into the actual tool calls of any single message
 *
 * Three list variants ship by default:
 *  - `assistants_only` — hide system/user/tool rows so a cost-per-answer
 *     report is one click away
 *  - `by_model` — grouped by model for A/B comparison
 *  - `slow` — pre-filtered to latency > 5s for tail-latency triage
 */
export const AiMessageView = defineView({
  list: {
    type: 'grid',
    data: { provider: 'object', object: 'ai_messages' },
    columns: [
      { field: 'created_at', label: 'Time' },
      { field: 'conversation_id', label: 'Conversation' },
      { field: 'role' },
      { field: 'model' },
      { field: 'prompt_tokens', label: 'Prompt' },
      { field: 'completion_tokens', label: 'Output' },
      { field: 'total_tokens', label: 'Total' },
      { field: 'latency_ms', label: 'Latency (ms)' },
    ],
    sort: [{ field: 'created_at', order: 'desc' }],
    pagination: { pageSize: 50 },
    searchableFields: ['conversation_id', 'content', 'tool_call_id'],
    filterableFields: ['role', 'model', 'conversation_id'],
  },
  listViews: {
    assistants_only: {
      label: 'Assistant turns',
      type: 'grid',
      data: { provider: 'object', object: 'ai_messages' },
      columns: [
        { field: 'created_at', label: 'Time' },
        { field: 'conversation_id', label: 'Conversation' },
        { field: 'model' },
        { field: 'prompt_tokens', label: 'Prompt' },
        { field: 'completion_tokens', label: 'Output' },
        { field: 'total_tokens', label: 'Total' },
        { field: 'latency_ms', label: 'Latency (ms)' },
        { field: 'content', label: 'Reply (preview)' },
      ],
      filter: [{ field: 'role', operator: '=', value: 'assistant' }],
      sort: [{ field: 'created_at', order: 'desc' }],
    },
    by_model: {
      label: 'By model',
      type: 'grid',
      data: { provider: 'object', object: 'ai_messages' },
      columns: [
        { field: 'model' },
        { field: 'created_at', label: 'Time' },
        { field: 'latency_ms', label: 'Latency (ms)' },
        { field: 'total_tokens', label: 'Tokens' },
        { field: 'conversation_id', label: 'Conversation' },
      ],
      filter: [{ field: 'role', operator: '=', value: 'assistant' }],
      sort: [
        { field: 'model', order: 'asc' },
        { field: 'created_at', order: 'desc' },
      ],
    },
    slow: {
      label: 'Slow turns (>5s)',
      type: 'grid',
      data: { provider: 'object', object: 'ai_messages' },
      columns: [
        { field: 'created_at', label: 'Time' },
        { field: 'model' },
        { field: 'latency_ms', label: 'Latency (ms)' },
        { field: 'total_tokens', label: 'Tokens' },
        { field: 'conversation_id', label: 'Conversation' },
      ],
      filter: [
        { field: 'role', operator: '=', value: 'assistant' },
        { field: 'latency_ms', operator: '>', value: 5000 },
      ],
      sort: [{ field: 'latency_ms', order: 'desc' }],
    },
  },
});
