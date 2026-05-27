// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { ApprovalProcess } from '@objectstack/spec/automation';

/**
 * Approval process — discount above 20% requires manager + finance sign-off.
 * Exercises the Approval form (entryCriteria, multi-step approvers, behaviors).
 */
export const DiscountApprovalProcess: ApprovalProcess = {
  name: 'discount_approval',
  label: 'Discount Approval',
  description: 'Approval required for discounts greater than 20%.',
  object: 'crm_opportunity',
  active: true,
  lockRecord: true,
  entryCriteria: 'discount_percent > 20',
  steps: [
    {
      name: 'manager_approval',
      label: 'Manager Approval',
      description: 'Sales manager reviews the proposed discount.',
      approvers: [{ type: 'role', value: 'sales_manager' }],
      behavior: 'first_response',
      rejectionBehavior: 'reject_process',
    },
    {
      name: 'finance_approval',
      label: 'Finance Approval',
      description: 'Finance signs off on margin impact.',
      approvers: [{ type: 'role', value: 'finance_lead' }],
      behavior: 'unanimous',
      rejectionBehavior: 'back_to_previous',
    },
  ],
};
