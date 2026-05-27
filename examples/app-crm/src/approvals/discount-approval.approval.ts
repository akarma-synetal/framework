// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { Automation } from '@objectstack/spec';

/**
 * Example approval process — discount approval on opportunities.
 * Routes to sales manager, then finance.
 */
export const DiscountApprovalProcess: Automation.ApprovalProcess = {
  name: 'crm_discount_approval',
  label: 'Opportunity Discount Approval',
  object: 'crm_opportunity',
  active: true,
  description: 'Two-step approval for opportunities with significant discounts.',
  entryCriteria: 'record.discount_percent > 20',
  lockRecord: true,
  steps: [
    {
      name: 'manager_review',
      label: 'Manager Review',
      description: 'First-line sales manager reviews the discount.',
      approvers: [{ type: 'role', value: 'sales_manager' }],
      behavior: 'first_response',
      rejectionBehavior: 'reject_process',
    },
    {
      name: 'finance_review',
      label: 'Finance Review',
      description: 'Finance signs off if discount exceeds 30%.',
      entryCriteria: 'record.discount_percent > 30',
      approvers: [{ type: 'role', value: 'finance_approver' }],
      behavior: 'unanimous',
      rejectionBehavior: 'back_to_previous',
    },
  ],
};
