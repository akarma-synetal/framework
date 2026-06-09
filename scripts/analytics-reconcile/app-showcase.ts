// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.
//
// ADR-0021 Phase 2 — reconciliation runner for examples/app-showcase.
//   pnpm tsx scripts/analytics-reconcile/app-showcase.ts

import ShowcaseApp from '../../examples/app-showcase/objectstack.config.js';
import { ChartGalleryDashboard } from '../../examples/app-showcase/src/dashboards/chart-gallery.dashboard.js';
import { ShowcaseTaskDataset, ShowcaseProjectDataset } from '../../examples/app-showcase/src/datasets/chart-gallery.dataset.js';
import { allReports } from '../../examples/app-showcase/src/reports/index.js';
import { reconcileApp, runAsMain } from './boot.js';

runAsMain(() => reconcileApp({
  appName: 'app-showcase',
  config: ShowcaseApp,
  dashboards: [ChartGalleryDashboard],
  reports: allReports,
  datasets: [ShowcaseTaskDataset, ShowcaseProjectDataset],
}));
