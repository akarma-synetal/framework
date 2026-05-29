// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { defineView } from '@objectstack/spec';

/**
 * ai_eval_runs — built-in Studio comparison views.
 *
 * The eval runner writes one row per `(case, model)` execution. Three
 * preset views are shipped so operators can answer the most common
 * regression questions without writing ObjectQL:
 *
 *  - `failures` — only fail/error rows, newest first; the triage queue.
 *  - `by_model` — grouped by model id for at-a-glance A/B comparison.
 *  - `latest_per_case` — chronologically newest run per case (best
 *     consumed via the score column for a quick health dashboard).
 */
export const AiEvalRunView = defineView({
  list: {
    type: 'grid',
    data: { provider: 'object', object: 'ai_eval_runs' },
    columns: [
      { field: 'run_at', label: 'Run At' },
      { field: 'case_id', label: 'Case' },
      { field: 'agent_id', label: 'Agent' },
      { field: 'model' },
      { field: 'status' },
      { field: 'score' },
      { field: 'latency_ms', label: 'Latency (ms)' },
      { field: 'total_tokens', label: 'Tokens' },
    ],
    sort: [{ field: 'run_at', order: 'desc' }],
    pagination: { pageSize: 50 },
    filterableFields: ['status', 'model', 'agent_id', 'case_id'],
    searchableFields: ['response', 'judge_reasoning'],
  },
  listViews: {
    failures: {
      label: 'Failures & errors',
      type: 'grid',
      data: { provider: 'object', object: 'ai_eval_runs' },
      columns: [
        { field: 'run_at', label: 'Run At' },
        { field: 'case_id', label: 'Case' },
        { field: 'model' },
        { field: 'status' },
        { field: 'score' },
        { field: 'error' },
        { field: 'judge_reasoning' },
      ],
      filter: [{ field: 'status', operator: 'in', value: ['fail', 'error'] }],
      sort: [{ field: 'run_at', order: 'desc' }],
    },
    by_model: {
      label: 'By model',
      type: 'grid',
      data: { provider: 'object', object: 'ai_eval_runs' },
      columns: [
        { field: 'model' },
        { field: 'case_id', label: 'Case' },
        { field: 'status' },
        { field: 'score' },
        { field: 'latency_ms', label: 'Latency (ms)' },
        { field: 'total_tokens', label: 'Tokens' },
        { field: 'run_at', label: 'Run At' },
      ],
      sort: [
        { field: 'model', order: 'asc' },
        { field: 'run_at', order: 'desc' },
      ],
    },
    latest_per_case: {
      label: 'Latest per case',
      type: 'grid',
      data: { provider: 'object', object: 'ai_eval_runs' },
      columns: [
        { field: 'case_id', label: 'Case' },
        { field: 'model' },
        { field: 'status' },
        { field: 'score' },
        { field: 'latency_ms', label: 'Latency (ms)' },
        { field: 'run_at', label: 'Run At' },
      ],
      sort: [
        { field: 'case_id', order: 'asc' },
        { field: 'run_at', order: 'desc' },
      ],
    },
  },
});

/**
 * ai_eval_cases — basic curation view.
 *
 * No special list variants — operators primarily reach individual cases
 * via the agent detail page or via the eval-runs view; this surface
 * mostly exists to let them add / edit cases inside Studio.
 */
export const AiEvalCaseView = defineView({
  list: {
    type: 'grid',
    data: { provider: 'object', object: 'ai_eval_cases' },
    columns: [
      { field: 'name' },
      { field: 'agent_id', label: 'Agent' },
      { field: 'enabled' },
      { field: 'expected_contains', label: 'Expected (substring)' },
      { field: 'expected_regex', label: 'Expected (regex)' },
      { field: 'updated_at' },
    ],
    sort: [{ field: 'updated_at', order: 'desc' }],
    pagination: { pageSize: 50 },
    filterableFields: ['agent_id', 'enabled'],
    searchableFields: ['name', 'description', 'input'],
  },
});
