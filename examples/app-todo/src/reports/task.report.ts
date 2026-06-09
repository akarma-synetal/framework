// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { ReportInput } from '@objectstack/spec/ui';

// ADR-0021 Phase 2: each report below carries a `task_metrics` dataset binding
// (`dataset` + `rows` + `values`, measures referenced BY NAME) alongside the
// legacy inline query during the dual-form window. The reconciliation harness
// asserts both forms return identical numbers (scripts/analytics-reconcile).
// When the inline form is removed, the detail columns move to a click-through
// drilldown (per the migration decision); `overdue_tasks` becomes a ListView.

/** Tasks by Status Report */
export const TasksByStatusReport: ReportInput = {
  name: 'tasks_by_status',
  label: 'Tasks by Status',
  description: 'Summary of tasks grouped by status',
  objectName: 'todo_task',
  type: 'summary',
  columns: [
    { field: 'subject', label: 'Subject' },
    { field: 'priority', label: 'Priority' },
    { field: 'due_date', label: 'Due Date' },
    { field: 'owner', label: 'Assigned To' },
  ],
  groupingsDown: [{ field: 'status', sortOrder: 'asc' }],
  dataset: 'task_metrics',
  rows: ['status'],
  values: ['task_count'],
};

/** Tasks by Priority Report */
export const TasksByPriorityReport: ReportInput = {
  name: 'tasks_by_priority',
  label: 'Tasks by Priority',
  description: 'Summary of tasks grouped by priority level',
  objectName: 'todo_task',
  type: 'summary',
  columns: [
    { field: 'subject', label: 'Subject' },
    { field: 'status', label: 'Status' },
    { field: 'due_date', label: 'Due Date' },
    { field: 'category', label: 'Category' },
  ],
  groupingsDown: [{ field: 'priority', sortOrder: 'desc' }],
  filter: { is_completed: false },
  dataset: 'task_metrics',
  rows: ['priority'],
  values: ['task_count'],
  runtimeFilter: { is_completed: false },
};

/** Tasks by Owner Report */
export const TasksByOwnerReport: ReportInput = {
  name: 'tasks_by_owner',
  label: 'Tasks by Owner',
  description: 'Task summary by assignee',
  objectName: 'todo_task',
  type: 'summary',
  columns: [
    { field: 'subject', label: 'Subject' },
    { field: 'status', label: 'Status' },
    { field: 'priority', label: 'Priority' },
    { field: 'due_date', label: 'Due Date' },
    { field: 'estimated_hours', label: 'Est. Hours', aggregate: 'sum' },
    { field: 'actual_hours', label: 'Actual Hours', aggregate: 'sum' },
  ],
  groupingsDown: [{ field: 'owner', sortOrder: 'asc' }],
  filter: { is_completed: false },
  dataset: 'task_metrics',
  rows: ['owner'],
  values: ['est_hours', 'actual_hours'],
  runtimeFilter: { is_completed: false },
};

// ADR-0021 Phase 2: the former `OverdueTasksReport` (a flat record list, no
// grouping/aggregation) is now the `overdue` ListView on todo_task — see
// src/views/task.view.ts. A flat record list is an object-bound row lens
// (ADR-0017), not a dataset report.

/** Completed Tasks Report */
export const CompletedTasksReport: ReportInput = {
  name: 'completed_tasks',
  label: 'Completed Tasks',
  description: 'All completed tasks with time tracking',
  objectName: 'todo_task',
  type: 'summary',
  columns: [
    { field: 'subject', label: 'Subject' },
    { field: 'completed_date', label: 'Completed Date' },
    { field: 'estimated_hours', label: 'Est. Hours', aggregate: 'sum' },
    { field: 'actual_hours', label: 'Actual Hours', aggregate: 'sum' },
  ],
  groupingsDown: [{ field: 'category', sortOrder: 'asc' }],
  filter: { is_completed: true },
  dataset: 'task_metrics',
  rows: ['category'],
  values: ['est_hours', 'actual_hours'],
  runtimeFilter: { is_completed: true },
};

/** Time Tracking Report */
export const TimeTrackingReport: ReportInput = {
  name: 'time_tracking',
  label: 'Time Tracking Report',
  description: 'Estimated vs actual hours analysis',
  objectName: 'todo_task',
  type: 'matrix',
  columns: [
    { field: 'estimated_hours', label: 'Estimated Hours', aggregate: 'sum' },
    { field: 'actual_hours', label: 'Actual Hours', aggregate: 'sum' },
  ],
  groupingsDown: [{ field: 'owner', sortOrder: 'asc' }],
  groupingsAcross: [{ field: 'category', sortOrder: 'asc' }],
  filter: { is_completed: true },
  // Matrix: the dataset form flattens rows+across into `rows` for now (cell
  // values are identical); a dataset-bound `columns`/across dimension is a
  // follow-up before single-form convergence.
  dataset: 'task_metrics',
  rows: ['owner', 'category'],
  values: ['est_hours', 'actual_hours'],
  runtimeFilter: { is_completed: true },
};
