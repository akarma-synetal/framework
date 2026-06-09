// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.
//
// ADR-0021 Phase 2 — reconciliation runner for examples/app-todo.
//   pnpm tsx scripts/analytics-reconcile/app-todo.ts

import TodoApp from '../../examples/app-todo/objectstack.config.js';
import { TaskDashboard } from '../../examples/app-todo/src/dashboards/task.dashboard.js';
import { TaskDataset } from '../../examples/app-todo/src/datasets/task.dataset.js';
import * as reports from '../../examples/app-todo/src/reports/index.js';
import type { Report } from '@objectstack/spec/ui';
import { reconcileApp, runAsMain } from './boot.js';

runAsMain(() => reconcileApp({
  appName: 'app-todo',
  config: TodoApp,
  dashboards: [TaskDashboard],
  reports: Object.values(reports) as Report[],
  datasets: [TaskDataset],
}));
