// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { Dashboard } from '@objectstack/spec/ui';

export const PipelineDashboard: Dashboard = {
  name: 'pipeline_dashboard',
  label: 'Pipeline Dashboard',
  description: 'Aggregate view of the sales pipeline.',
  columns: 12,
  widgets: [
    {
      id: 'total_pipeline',
      type: 'metric',
      title: 'Total Pipeline ($)',
      description: 'Sum of opportunity amounts across open stages.',
      object: 'opportunity',
      aggregate: 'sum',
      valueField: 'amount',
      filter: { stage: { $nin: ['closed_won', 'closed_lost'] } },
      layout: { x: 0, y: 0, w: 4, h: 2 },
    },
    {
      id: 'opportunities_by_stage',
      type: 'bar',
      title: 'Opportunities by Stage',
      description: 'Count of opportunities grouped by their pipeline stage.',
      object: 'opportunity',
      aggregate: 'count',
      categoryField: 'stage',
      layout: { x: 4, y: 0, w: 8, h: 4 },
    },
  ],
};
