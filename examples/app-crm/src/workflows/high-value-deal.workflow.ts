// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { WorkflowRule } from '@objectstack/spec/automation';

/**
 * Workflow — fire an email alert when a high-value opportunity is created
 * or its amount changes. Exercises the Workflow form (trigger type, criteria
 * formula, executionOrder, reevaluation, action list).
 */
export const HighValueDealWorkflow: WorkflowRule = {
  name: 'high_value_deal_alert',
  label: 'High-Value Deal Alert',
  description: 'Notify sales managers when an opportunity exceeds $100k.',
  objectName: 'crm_opportunity',
  triggerType: 'on_create_or_update',
  criteria: 'amount > 100000',
  active: true,
  executionOrder: 10,
  reevaluateOnChange: true,
  actions: [
    {
      type: 'email_alert',
      name: 'notify_manager',
      template: 'high_value_deal_email',
      recipients: ['role:sales_manager'],
    },
  ],
};
