// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { defineStack } from '@objectstack/spec';

import * as objects from './src/objects/index.js';
import * as views from './src/views/index.js';
import * as apps from './src/apps/index.js';
import * as dashboards from './src/dashboards/index.js';
import * as reports from './src/reports/index.js';
import * as pages from './src/pages/index.js';
import * as actions from './src/actions/index.js';
import * as emails from './src/emails/index.js';
import { allHooks } from './src/hooks/index.js';
import { allFlows } from './src/flows/index.js';
import { HighValueDealWorkflow } from './src/workflows/index.js';
import { DiscountApprovalProcess } from './src/approvals/index.js';
import {
  SalesAssistantAgent,
  LookupContactTool,
  DealManagementSkill,
} from './src/agents/index.js';
import {
  SalesRepRole,
  SalesManagerRole,
  SalesUserPermissionSet,
} from './src/security/index.js';
import { CrmSeedData } from './src/data/index.js';

/**
 * Minimal CRM example — a smoke-test workspace that exercises the
 * metadata loading pipeline. Contains at least one record of every
 * form-bearing metadata type so the Studio metadata-admin UI can be
 * developed and validated against real data:
 *
 *   - objects, fields, views, apps, dashboards, reports, pages, actions
 *   - hooks, flows, workflows, approvals
 *   - AI agents, tools, skills
 *   - roles, permission sets, email templates
 *
 * For a full enterprise reference (10+ objects, RAG, sharing rules,
 * approval flows, multi-driver E2E) see
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

  // Data
  objects: Object.values(objects),

  // UI
  apps: Object.values(apps),
  views: Object.values(views),
  pages: Object.values(pages),
  dashboards: Object.values(dashboards),
  reports: Object.values(reports),
  actions: Object.values(actions),

  // Logic
  hooks: allHooks,
  flows: allFlows,
  workflows: [HighValueDealWorkflow],
  approvals: [DiscountApprovalProcess],

  // AI
  agents: [SalesAssistantAgent],
  skills: [DealManagementSkill],
  // Note: standalone `tools:` array isn't a stack collection key —
  // tools are auto-registered from object actions or via service-ai
  // plugins. The exported `LookupContactTool` is kept here as a
  // reference template for the AI Tool metadata form.

  // Security
  roles: [SalesRepRole, SalesManagerRole],
  permissions: [SalesUserPermissionSet],

  // System — email templates are loaded via service-email seed data;
  // exported here as reference templates for the Email Template form.
  // (Reference: emails.DealWonEmail)

  // Seed data
  data: CrmSeedData,
});

// Re-export non-stack items so dead-code analysis doesn't strip them
// and so consumers can introspect what example metadata ships with CRM.
export const referenceMetadata = {
  tools: [LookupContactTool],
  emailTemplates: Object.values(emails),
};
