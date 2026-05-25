// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { defineView } from '@objectstack/spec';

/**
 * ai_pending_actions — built-in Studio inbox view.
 *
 * Surfaces the HITL approval queue: every action the LLM proposed that
 * was classified "dangerous" (confirmText, mode='delete', variant='danger')
 * and gated behind human approval. Operators triage from this list and
 * either Approve (re-runs the action immediately under the AI principal)
 * or Reject (closes the row without execution).
 *
 * Bundled with the platform so users don't need to author a view for
 * a system table. Appears automatically in Studio when AIService is
 * loaded with `enableActionApproval: true`.
 */
export const AiPendingActionView = defineView({
  list: {
    type: 'grid',
    data: { provider: 'object', object: 'ai_pending_actions' },
    columns: [
      { field: 'proposed_at', label: 'Proposed' },
      { field: 'object_name', label: 'Object' },
      { field: 'action_name', label: 'Action' },
      { field: 'status' },
      { field: 'proposed_by', label: 'Proposed by' },
      { field: 'decided_by', label: 'Decided by' },
      { field: 'decided_at', label: 'Decided' },
    ],
    sort: [{ field: 'proposed_at', order: 'desc' }],
    pagination: { pageSize: 50 },
    searchableFields: ['action_name', 'object_name', 'tool_name', 'proposed_by'],
    filterableFields: ['status', 'object_name', 'action_name'],
  },
  listViews: {
    pending: {
      label: 'Pending',
      type: 'grid',
      data: { provider: 'object', object: 'ai_pending_actions' },
      columns: [
        { field: 'proposed_at', label: 'Proposed' },
        { field: 'object_name', label: 'Object' },
        { field: 'action_name', label: 'Action' },
        { field: 'proposed_by', label: 'Proposed by' },
      ],
      filter: [{ field: 'status', operator: '=', value: 'pending' }],
      sort: [{ field: 'proposed_at', order: 'desc' }],
    },
    executed: {
      label: 'Executed',
      type: 'grid',
      data: { provider: 'object', object: 'ai_pending_actions' },
      columns: [
        { field: 'decided_at', label: 'Approved' },
        { field: 'object_name', label: 'Object' },
        { field: 'action_name', label: 'Action' },
        { field: 'decided_by', label: 'Approved by' },
      ],
      filter: [{ field: 'status', operator: '=', value: 'executed' }],
      sort: [{ field: 'decided_at', order: 'desc' }],
    },
    rejected: {
      label: 'Rejected',
      type: 'grid',
      data: { provider: 'object', object: 'ai_pending_actions' },
      columns: [
        { field: 'decided_at', label: 'Rejected' },
        { field: 'object_name', label: 'Object' },
        { field: 'action_name', label: 'Action' },
        { field: 'decided_by', label: 'Rejected by' },
        { field: 'rejection_reason', label: 'Reason' },
      ],
      filter: [{ field: 'status', operator: '=', value: 'rejected' }],
      sort: [{ field: 'decided_at', order: 'desc' }],
    },
    failed: {
      label: 'Failed',
      type: 'grid',
      data: { provider: 'object', object: 'ai_pending_actions' },
      columns: [
        { field: 'decided_at', label: 'When' },
        { field: 'object_name', label: 'Object' },
        { field: 'action_name', label: 'Action' },
        { field: 'error' },
      ],
      filter: [{ field: 'status', operator: '=', value: 'failed' }],
      sort: [{ field: 'decided_at', order: 'desc' }],
    },
  },
});
