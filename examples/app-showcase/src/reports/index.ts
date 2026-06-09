// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { Report } from '@objectstack/spec/ui';

const task = 'showcase_task';

// ADR-0021 Phase 2: the former `TaskListReport` (showcase_task_list) — a flat
// record list — was converted to the `tabular` ListView on showcase_task
// (src/views/task.view.ts). A flat list is an object-bound row lens (ADR-0017),
// not analytics, so it is no longer a report.

/** 2 ── Summary: grouped down by status with a sum. */
export const HoursByStatusReport: Report = {
  name: 'showcase_hours_by_status',
  label: 'Hours by Status (Summary)',
  description: 'Estimated hours grouped by task status.',
  objectName: task,
  type: 'summary',
  columns: [
    { field: 'status', label: 'Status' },
    { field: 'estimate_hours', label: 'Hours', aggregate: 'sum' },
  ],
  groupingsDown: [{ field: 'status', sortOrder: 'asc' }],
  // ADR-0021 Phase 2 — dataset binding (dual-form).
  dataset: 'showcase_task_metrics',
  rows: ['status'],
  values: ['est_hours'],
};

/** 3 ── Matrix: status (down) × priority (across) cross-tab. */
export const StatusPriorityMatrixReport: Report = {
  name: 'showcase_status_priority_matrix',
  label: 'Status × Priority (Matrix)',
  description: 'Task counts cross-tabulated by status and priority.',
  objectName: task,
  type: 'matrix',
  columns: [{ field: 'estimate_hours', label: 'Hours', aggregate: 'sum' }],
  groupingsDown: [{ field: 'status', sortOrder: 'asc' }],
  groupingsAcross: [{ field: 'priority', sortOrder: 'asc' }],
  // ADR-0021 Phase 2 — dataset binding (dual-form). Matrix flattens rows+across
  // into `rows` for now (cell values identical); across-dimension is a follow-up.
  dataset: 'showcase_task_metrics',
  rows: ['status', 'priority'],
  values: ['est_hours'],
};

/** 4 ── Joined: multiple stacked blocks in one report. */
export const TaskOverviewReport: Report = {
  name: 'showcase_task_overview',
  label: 'Task Overview (Joined)',
  description: 'Multiple task sub-reports stacked into one joined view.',
  objectName: task,
  type: 'joined',
  columns: [],
  blocks: [
    {
      // Analytics block → dataset-bound (dual-form); reconciled by the harness.
      name: 'open_block',
      label: 'Open Tasks',
      type: 'summary',
      objectName: task,
      columns: [{ field: 'estimate_hours', label: 'Hours', aggregate: 'sum' }],
      groupingsDown: [{ field: 'status', sortOrder: 'asc' }],
      filter: { done: false },
      dataset: 'showcase_task_metrics',
      rows: ['status'],
      values: ['est_hours'],
      runtimeFilter: { done: false },
    },
    {
      // Record-list block → stays inline (a ListView/embed in the terminal form).
      name: 'done_block',
      label: 'Completed Tasks',
      type: 'tabular',
      objectName: task,
      columns: [
        { field: 'title', label: 'Title' },
        { field: 'assignee', label: 'Assignee' },
      ],
      filter: { done: true },
    },
  ],
};

export const allReports = [
  HoursByStatusReport,
  StatusPriorityMatrixReport,
  TaskOverviewReport,
];
