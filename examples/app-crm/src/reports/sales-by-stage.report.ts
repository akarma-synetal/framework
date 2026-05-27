// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { Report } from '@objectstack/spec/ui';

/**
 * Report — summary of opportunity amount grouped by stage. Exercises the
 * Report form (objectName, type, grouping, aggregates, columns).
 */
export const SalesByStageReport: Report = {
  name: 'sales_by_stage',
  label: 'Sales Pipeline by Stage',
  description: 'Pipeline value rolled up by sales stage.',
  objectName: 'crm_opportunity',
  type: 'summary',
  groupBy: ['stage'],
  columns: [
    { field: 'name', label: 'Opportunity' },
    { field: 'amount', label: 'Amount', aggregate: 'sum' },
    { field: 'probability', label: 'Avg Probability %', aggregate: 'avg' },
  ],
};
