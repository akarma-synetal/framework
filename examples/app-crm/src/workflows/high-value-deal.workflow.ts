// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { Automation } from '@objectstack/spec';

/**
 * Example workflow rule — flag high value deals.
 * When a CRM opportunity is created or updated with amount > 100k,
 * the rule fires. (No actions configured to keep the example minimal;
 * Studio shows the rule entry so admins can add email_alert/field_update.)
 */
export const HighValueDealWorkflow: Automation.WorkflowRule = {
  name: 'crm_high_value_deal_alert',
  objectName: 'crm_opportunity',
  triggerType: 'on_create_or_update',
  description: 'Notify sales managers when a deal larger than $100k is created or updated.',
  criteria: 'record.amount > 100000',
  active: true,
  executionOrder: 100,
  reevaluateOnChange: false,
};
