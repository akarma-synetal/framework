// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { ObjectSchema, Field } from '@objectstack/spec/data';

/**
 * sys_billing_period — A closed billing window for one organization.
 *
 * Created when a billing period opens (typically monthly) and finalised
 * when the window closes. Aggregated `sys_quota_usage` rows roll up to
 * the totals stored here for invoicing.
 *
 * Cloud-control only.
 *
 * @namespace sys
 */
export const SysBillingPeriod = ObjectSchema.create({
  name: 'sys_billing_period',
  label: 'Billing Period',
  pluralLabel: 'Billing Periods',
  icon: 'receipt',
  isSystem: true,
  managedBy: 'config',
  description: 'Closed billing window per organization with invoice totals.',
  displayNameField: 'label',
  titleFormat: '{label}',
  compactLayout: ['organization_id', 'period_start', 'period_end', 'status', 'total_amount'],
  userActions: { create: false, edit: true, delete: false, import: false },

  listViews: {
    current: {
      type: 'grid',
      name: 'current',
      label: 'Current',
      data: { provider: 'object', object: 'sys_billing_period' },
      columns: ['organization_id', 'label', 'period_start', 'period_end', 'status'],
      filter: [{ field: 'status', operator: 'equals', value: 'open' }],
      sort: [{ field: 'period_start', order: 'desc' }],
      pagination: { pageSize: 50 },
    },
    invoiced: {
      type: 'grid',
      name: 'invoiced',
      label: 'Invoiced',
      data: { provider: 'object', object: 'sys_billing_period' },
      columns: ['organization_id', 'label', 'period_end', 'total_amount', 'currency', 'invoice_number'],
      filter: [{ field: 'status', operator: 'in', value: ['invoiced', 'paid'] }],
      sort: [{ field: 'period_end', order: 'desc' }],
      pagination: { pageSize: 50 },
    },
    all_periods: {
      type: 'grid',
      name: 'all_periods',
      label: 'All',
      data: { provider: 'object', object: 'sys_billing_period' },
      columns: ['organization_id', 'label', 'period_start', 'period_end', 'status', 'total_amount'],
      sort: [{ field: 'period_start', order: 'desc' }],
      pagination: { pageSize: 100 },
    },
  },

  fields: {
    id: Field.text({ label: 'Period ID', required: true, readonly: true, group: 'System' }),

    organization_id: Field.lookup('sys_organization', {
      label: 'Organization',
      required: true,
      group: 'Definition',
    }),

    label: Field.text({
      label: 'Label',
      required: true,
      maxLength: 100,
      description: 'Human-readable window (e.g. "2026-05").',
      group: 'Definition',
    }),

    period_start: Field.datetime({
      label: 'Period Start',
      required: true,
      group: 'Definition',
    }),

    period_end: Field.datetime({
      label: 'Period End',
      required: true,
      group: 'Definition',
    }),

    status: Field.text({
      label: 'Status',
      required: true,
      defaultValue: 'open',
      maxLength: 32,
      description: 'open | closed | invoiced | paid | voided',
      group: 'Definition',
    }),

    currency: Field.text({
      label: 'Currency',
      required: true,
      defaultValue: 'USD',
      maxLength: 8,
      group: 'Billing',
    }),

    total_amount: Field.number({
      label: 'Total Amount',
      defaultValue: 0,
      description: 'Sum of charges in {currency}.',
      group: 'Billing',
    }),

    invoice_number: Field.text({
      label: 'Invoice Number',
      required: false,
      maxLength: 64,
      group: 'Billing',
    }),

    invoiced_at: Field.datetime({ label: 'Invoiced At', required: false, group: 'Billing' }),
    paid_at: Field.datetime({ label: 'Paid At', required: false, group: 'Billing' }),

    notes: Field.textarea({ label: 'Notes', required: false, group: 'Billing' }),

    created_at: Field.datetime({ label: 'Created At', defaultValue: 'NOW()', readonly: true, group: 'System' }),
    updated_at: Field.datetime({ label: 'Updated At', defaultValue: 'NOW()', readonly: true, group: 'System' }),
  },

  indexes: [
    { fields: ['organization_id', 'period_start'], unique: true },
    { fields: ['status'] },
  ],
});
