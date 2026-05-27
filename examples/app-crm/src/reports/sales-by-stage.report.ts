// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { UI } from '@objectstack/spec';

/**
 * Example report — total opportunity amount grouped by stage.
 */
export const SalesByStageReport: UI.Report = {
  name: 'crm_sales_by_stage',
  label: 'Sales by Stage',
  description: 'Total opportunity amount grouped by sales stage.',
  objectName: 'crm_opportunity',
  type: 'summary',
  columns: [
    { field: 'stage', label: 'Stage' },
    { field: 'name', label: 'Opportunity' },
    { field: 'amount', label: 'Amount' },
  ],
};
