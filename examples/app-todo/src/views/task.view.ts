// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { defineView } from '@objectstack/spec';

const data = { provider: 'object' as const, object: 'todo_task' };

/**
 * Task list views (ADR-0017 object-bound row lenses).
 *
 * ADR-0021 Phase 2: the former `overdue_tasks` *report* was a flat record list
 * (no grouping / aggregation), which is a ListView concern, not analytics. It
 * is converted here to an `overdue` grid view filtered to incomplete, overdue
 * tasks — replacing the report entirely.
 */
export const TaskViews = defineView({
  list: {
    label: 'All Tasks',
    type: 'grid',
    data,
    columns: [
      { field: 'subject' },
      { field: 'status' },
      { field: 'priority' },
      { field: 'due_date' },
      { field: 'owner' },
      { field: 'category' },
    ],
  },

  listViews: {
    // Replaces the legacy `overdue_tasks` report.
    overdue: {
      label: 'Overdue Tasks',
      type: 'grid',
      data,
      columns: [
        { field: 'subject' },
        { field: 'due_date' },
        { field: 'priority' },
        { field: 'owner' },
        { field: 'category' },
      ],
      filter: [
        { field: 'is_overdue', operator: 'equals', value: true },
        { field: 'is_completed', operator: 'equals', value: false },
      ],
      sort: [{ field: 'due_date', order: 'asc' }],
    },
  },
});
