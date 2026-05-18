// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { ReportInput } from '@objectstack/spec/ui';

export const LeadsBySourceReport: ReportInput = {
  name: 'leads_by_source',
  label: 'Leads by Source and Status',
  description: 'Lead pipeline analysis',
  objectName: 'lead',
  type: 'summary',
  columns: [
    { field: 'full_name', label: 'Name' },
    { field: 'company', label: 'Company' },
    { field: 'rating', label: 'Rating' },
  ],
  groupingsDown: [
    { field: 'lead_source', sortOrder: 'asc' },
    { field: 'status', sortOrder: 'asc' },
  ],
  filter: { is_converted: false },
  chart: { type: 'pie', title: 'Leads by Source', showLegend: true, xAxis: 'lead_source', yAxis: 'full_name' }
};

/**
 * Lead engagement trend — matrix with monthly bucketing on
 * `last_contacted_date` (a user-managed datetime, so it can be set in seed
 * data and varied across months for a realistic demo). Lets a marketing-ops
 * lead spot which channels we're actively working month-over-month.
 * Exercises the `dateGranularity: 'month'` server-side aggregation path.
 */
export const LeadInflowByMonthSourceReport: ReportInput = {
  name: 'lead_inflow_by_month_source',
  label: 'Lead Engagement by Month × Source',
  description: 'Contacted-lead volume per month, broken down by acquisition channel',
  objectName: 'lead',
  type: 'matrix',
  columns: [
    { field: 'id', label: 'Leads Touched', aggregate: 'count' },
  ],
  groupingsDown: [{ field: 'lead_source', sortOrder: 'asc' }],
  groupingsAcross: [
    { field: 'last_contacted_date', dateGranularity: 'month', sortOrder: 'asc' },
  ],
};
