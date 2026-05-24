// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { defineStack } from '@objectstack/spec';

import * as objects from './src/objects/index.js';
import * as views from './src/views/index.js';
import * as apps from './src/apps/index.js';
import * as dashboards from './src/dashboards/index.js';
import { allHooks } from './src/hooks/index.js';
import { allFlows } from './src/flows/index.js';
import { CrmSeedData } from './src/data/index.js';

/**
 * Minimal CRM example — a smoke-test workspace that exercises the
 * metadata loading pipeline (objects → views → app → dashboard →
 * hook → flow → seed).
 *
 * For a full enterprise reference (10+ objects, AI agents, RAG,
 * sharing rules, approval flows, multi-driver E2E) see
 *   https://github.com/objectstack-ai/hotcrm
 */
export default defineStack({
  manifest: {
    id: 'com.example.crm',
    namespace: 'crm',
    version: '4.0.0',
    type: 'app',
    name: 'CRM (minimal example)',
    description: 'Minimal CRM workspace used by the framework to validate the metadata loading pipeline end-to-end.',
  },

  // Auto-resolved by the CLI; `ui` enables the Studio shell.
  requires: ['ui'],

  objects: Object.values(objects),
  views: Object.values(views),
  apps: Object.values(apps),
  dashboards: Object.values(dashboards),
  hooks: allHooks,
  flows: allFlows,

  data: CrmSeedData,
});
