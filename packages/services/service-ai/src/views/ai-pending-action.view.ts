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
 * ## UI shape
 *
 * Studio renders three things from this definition:
 *
 * 1. A **list view** with four named tabs — pending / executed / rejected /
 *    failed — sorted reverse-chronologically. Each row is clickable.
 * 2. A **drawer detail view** (opened on row click) that shows the full
 *    tool-call envelope, the LLM context (conversation + message links),
 *    decision trail (proposed_at / decided_at relative timestamps), and
 *    outcome (result / error / rejection_reason in collapsible sections).
 * 3. The two object-level actions (`approve_pending_action`,
 *    `reject_pending_action`, declared on the object schema with
 *    `locations: ['list_item', 'record_header']`) are surfaced as both
 *    row-level buttons in the grid and primary buttons in the drawer
 *    header, hitting the REST contract directly.
 *
 * The drawer is conditionally-actionable: Approve/Reject buttons are only
 * useful for `status='pending'` rows, but Studio's per-row action filtering
 * handles that via the underlying record state.
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
      { field: 'proposed_at', label: 'Proposed', type: 'datetime-relative', width: 140 },
      { field: 'status', width: 130 },
      { field: 'object_name', label: 'Object', width: 140 },
      { field: 'action_name', label: 'Action', width: 180 },
      { field: 'proposed_by', label: 'Proposed by', width: 160 },
      { field: 'decided_by', label: 'Decided by', width: 160 },
      { field: 'decided_at', label: 'Decided', type: 'datetime-relative', width: 140 },
    ],
    sort: [{ field: 'proposed_at', order: 'desc' }],
    pagination: { pageSize: 50 },
    searchableFields: ['action_name', 'object_name', 'tool_name', 'proposed_by'],
    filterableFields: ['status', 'object_name', 'action_name'],
    rowActions: ['approve_pending_action', 'reject_pending_action'],
    // Click a row → open the detail drawer instead of navigating to a page.
    navigation: { mode: 'drawer', view: 'detail', width: '640px' },
    rowColor: {
      field: 'status',
      mapping: {
        pending: 'amber',
        approved: 'blue',
        executed: 'green',
        failed: 'red',
        rejected: 'gray',
      },
    } as never,
  },

  form: {
    type: 'drawer',
    data: { provider: 'object', object: 'ai_pending_actions' },
    sections: [
      {
        label: 'Proposal',
        columns: 2,
        fields: [
          { field: 'status', readonly: true },
          { field: 'proposed_at', readonly: true, widget: 'datetime-relative' },
          { field: 'object_name', label: 'Target object', readonly: true },
          { field: 'action_name', label: 'Action', readonly: true },
          { field: 'tool_name', label: 'Tool exposed to LLM', readonly: true, colSpan: 2 },
          { field: 'proposed_by', label: 'Proposed by (AI agent)', readonly: true, colSpan: 2 },
        ],
      },
      {
        label: 'Tool input',
        collapsible: true,
        columns: 1,
        fields: [
          {
            field: 'tool_input',
            label: 'Arguments the LLM sent',
            readonly: true,
            widget: 'json',
            colSpan: 1,
            helpText: 'Pretty-printed JSON. Review carefully before approving — this is the exact payload that will be re-played against the handler.',
          },
        ],
      },
      {
        label: 'Conversation context',
        collapsible: true,
        collapsed: true,
        columns: 2,
        fields: [
          // Both are lookups — Studio renders them as links to the related
          // ai_conversations / ai_messages record so operators can jump to
          // the full transcript for context.
          { field: 'conversation_id', label: 'Conversation', readonly: true },
          { field: 'message_id', label: 'Assistant message', readonly: true },
        ],
      },
      {
        label: 'Decision',
        collapsible: true,
        // Only meaningful once the row has been actioned; left collapsed
        // by default for pending rows so the eye lands on the proposal.
        collapsed: true,
        columns: 2,
        fields: [
          { field: 'decided_by', label: 'Decided by', readonly: true },
          { field: 'decided_at', label: 'Decided', readonly: true, widget: 'datetime-relative' },
          {
            field: 'rejection_reason',
            label: 'Rejection reason',
            readonly: true,
            colSpan: 2,
            visibleOn: 'record.status == "rejected"',
          },
          {
            field: 'result',
            label: 'Execution result',
            readonly: true,
            widget: 'json',
            colSpan: 2,
            visibleOn: 'record.status == "executed"',
          },
          {
            field: 'error',
            label: 'Error',
            readonly: true,
            colSpan: 2,
            visibleOn: 'record.status == "failed"',
          },
        ],
      },
    ],
  },

  formViews: {
    detail: {
      type: 'drawer',
      data: { provider: 'object', object: 'ai_pending_actions' },
      // Mirror of the default form. Named separately so the list's
      // `navigation.view: 'detail'` resolves explicitly — Studio falls back
      // to `form` if a named view isn't registered, but being explicit
      // makes the wiring legible to readers of the metadata.
      sections: [
        {
          label: 'Proposal',
          columns: 2,
          fields: [
            { field: 'status', readonly: true },
            { field: 'proposed_at', readonly: true, widget: 'datetime-relative' },
            { field: 'object_name', label: 'Target object', readonly: true },
            { field: 'action_name', label: 'Action', readonly: true },
            { field: 'tool_name', label: 'Tool exposed to LLM', readonly: true, colSpan: 2 },
            { field: 'proposed_by', label: 'Proposed by (AI agent)', readonly: true, colSpan: 2 },
          ],
        },
        {
          label: 'Tool input',
          collapsible: true,
          columns: 1,
          fields: [
            { field: 'tool_input', label: 'Arguments the LLM sent', readonly: true, widget: 'json' },
          ],
        },
        {
          label: 'Conversation context',
          collapsible: true,
          collapsed: true,
          columns: 2,
          fields: [
            { field: 'conversation_id', label: 'Conversation', readonly: true },
            { field: 'message_id', label: 'Assistant message', readonly: true },
          ],
        },
        {
          label: 'Decision',
          collapsible: true,
          collapsed: true,
          columns: 2,
          fields: [
            { field: 'decided_by', label: 'Decided by', readonly: true },
            { field: 'decided_at', label: 'Decided', readonly: true, widget: 'datetime-relative' },
            { field: 'rejection_reason', label: 'Rejection reason', readonly: true, colSpan: 2, visibleOn: 'record.status == "rejected"' },
            { field: 'result', label: 'Execution result', readonly: true, widget: 'json', colSpan: 2, visibleOn: 'record.status == "executed"' },
            { field: 'error', label: 'Error', readonly: true, colSpan: 2, visibleOn: 'record.status == "failed"' },
          ],
        },
      ],
    },
  },

  listViews: {
    pending: {
      label: 'Pending',
      type: 'grid',
      data: { provider: 'object', object: 'ai_pending_actions' },
      columns: [
        { field: 'proposed_at', label: 'Proposed', type: 'datetime-relative', width: 140 },
        { field: 'object_name', label: 'Object', width: 140 },
        { field: 'action_name', label: 'Action', width: 180 },
        { field: 'proposed_by', label: 'Proposed by', width: 160 },
        { field: 'tool_name', label: 'Tool', width: 200 },
      ],
      filter: [{ field: 'status', operator: '=', value: 'pending' }],
      sort: [{ field: 'proposed_at', order: 'desc' }],
      rowActions: ['approve_pending_action', 'reject_pending_action'],
      navigation: { mode: 'drawer', view: 'detail', width: '640px' },
    },
    executed: {
      label: 'Executed',
      type: 'grid',
      data: { provider: 'object', object: 'ai_pending_actions' },
      columns: [
        { field: 'decided_at', label: 'Approved', type: 'datetime-relative', width: 140 },
        { field: 'object_name', label: 'Object', width: 140 },
        { field: 'action_name', label: 'Action', width: 180 },
        { field: 'decided_by', label: 'Approved by', width: 160 },
        { field: 'proposed_by', label: 'Proposed by', width: 160 },
      ],
      filter: [{ field: 'status', operator: '=', value: 'executed' }],
      sort: [{ field: 'decided_at', order: 'desc' }],
      navigation: { mode: 'drawer', view: 'detail', width: '640px' },
    },
    rejected: {
      label: 'Rejected',
      type: 'grid',
      data: { provider: 'object', object: 'ai_pending_actions' },
      columns: [
        { field: 'decided_at', label: 'Rejected', type: 'datetime-relative', width: 140 },
        { field: 'object_name', label: 'Object', width: 140 },
        { field: 'action_name', label: 'Action', width: 180 },
        { field: 'decided_by', label: 'Rejected by', width: 160 },
        { field: 'rejection_reason', label: 'Reason', wrap: true },
      ],
      filter: [{ field: 'status', operator: '=', value: 'rejected' }],
      sort: [{ field: 'decided_at', order: 'desc' }],
      navigation: { mode: 'drawer', view: 'detail', width: '640px' },
    },
    failed: {
      label: 'Failed',
      type: 'grid',
      data: { provider: 'object', object: 'ai_pending_actions' },
      columns: [
        { field: 'decided_at', label: 'When', type: 'datetime-relative', width: 140 },
        { field: 'object_name', label: 'Object', width: 140 },
        { field: 'action_name', label: 'Action', width: 180 },
        { field: 'error', wrap: true },
      ],
      filter: [{ field: 'status', operator: '=', value: 'failed' }],
      sort: [{ field: 'decided_at', order: 'desc' }],
      navigation: { mode: 'drawer', view: 'detail', width: '640px' },
    },
  },
});
