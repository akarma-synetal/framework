// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { defineForm } from '../ui/view.zod';

/**
 * Approval Process Metadata Form
 * 
 * Form layout for creating/editing approval process metadata definitions.
 */
export const approvalForm = defineForm({
  schemaId: 'approval',
  type: 'simple',
  sections: [
    {
      label: 'Basics',
      description: 'Approval process identity and the object it gates.',
      columns: 2,
      fields: [
        { field: 'name', required: true, colSpan: 1, helpText: 'Unique identifier (snake_case)' },
        { field: 'label', required: true, colSpan: 1, helpText: 'Display name (e.g., "Contract Approval")' },
        { field: 'object', widget: 'ref:object', required: true, colSpan: 1, helpText: 'Which object needs approval' },
        { field: 'active', colSpan: 1, helpText: 'Enable/disable this approval process' },
        { field: 'description', widget: 'textarea', colSpan: 2, helpText: 'What gets approved and why' },
      ],
    },
    {
      label: 'Entry rules',
      description: 'Who can submit, and what happens to the record while pending.',
      collapsible: true,
      collapsed: true,
      fields: [
        { field: 'entryCriteria', widget: 'textarea', helpText: 'CEL expression: users can submit only when this is true' },
        { field: 'lockRecord', helpText: 'Lock record from editing while approval is pending' },
        { field: 'approvalStatusField', helpText: 'Field name to mirror approval status (e.g., "approval_status")' },
      ],
    },
    {
      label: 'Steps',
      description: 'Ordered approval chain — each step picks the approver and decides routing.',
      fields: [
        {
          field: 'steps',
          type: 'repeater',
          required: true,
          helpText: 'Approval steps in order — each step defines who approves and what happens',
        },
      ],
    },
    {
      label: 'Escalation & outcomes',
      description: 'SLA, escalation, and post-decision actions.',
      collapsible: true,
      collapsed: true,
      fields: [
        { field: 'escalation', type: 'composite', helpText: 'Auto-escalate or auto-approve after timeout' },
        { field: 'onFinalApprove', type: 'repeater', helpText: 'Actions when all steps approved (e.g., update status)' },
        { field: 'onFinalReject', type: 'repeater', helpText: 'Actions when rejected (e.g., notify submitter)' },
      ],
    },
  ],
});
