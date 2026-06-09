// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.
//
// ADR-0021 Phase 2 — reconciliation runner for examples/app-crm.
//   pnpm tsx scripts/analytics-reconcile/app-crm.ts

import CrmApp from '../../examples/app-crm/objectstack.config.js';
import { PipelineDashboard } from '../../examples/app-crm/src/dashboards/pipeline.dashboard.js';
import { OpportunityDataset } from '../../examples/app-crm/src/datasets/opportunity.dataset.js';
import { SalesByStageReport } from '../../examples/app-crm/src/reports/sales-by-stage.report.js';
import { reconcileApp, runAsMain } from './boot.js';

runAsMain(() => reconcileApp({
  appName: 'app-crm',
  config: CrmApp,
  dashboards: [PipelineDashboard],
  reports: [SalesByStageReport],
  datasets: [OpportunityDataset],
}));
