// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { defineForm } from '../ui/view.zod';

/**
 * Flow Metadata Form
 * 
 * Form layout for creating/editing visual flow metadata definitions.
 */
export const flowForm = defineForm({
  schemaId: 'flow',
  type: 'simple',
  sections: [
    {
      label: 'Basics',
      description: 'Flow identity and how it starts.',
      columns: 2,
      fields: [
        { field: 'name', required: true, colSpan: 1, helpText: 'Unique identifier (snake_case)' },
        { field: 'label', required: true, colSpan: 1, helpText: 'Display name for users' },
        { field: 'type', required: true, colSpan: 1, helpText: 'How the flow starts (autolaunched, record_change, schedule, screen, api)' },
        { field: 'template', colSpan: 1, helpText: 'Is this a reusable subflow (can be called from other flows)' },
        { field: 'description', widget: 'textarea', colSpan: 2, helpText: 'What this flow does' },
      ],
    },
    {
      label: 'Canvas',
      description: 'Nodes, edges, and flow variables — consider the visual designer for complex flows.',
      fields: [
        {
          field: 'nodes',
          type: 'repeater',
          required: true,
          helpText: '⚠️ Consider using Flow Designer visual editor instead of JSON',
        },
        {
          field: 'edges',
          type: 'repeater',
          required: true,
          helpText: 'Connections between nodes — use Flow Designer for easier editing',
        },
        { field: 'variables', type: 'repeater', helpText: 'Flow variables (inputs/outputs)' },
      ],
    },
    {
      label: 'Execution',
      description: 'Deployment status, identity, and error handling.',
      collapsible: true,
      collapsed: true,
      columns: 2,
      fields: [
        { field: 'status', required: true, colSpan: 1, helpText: 'Deployment status: draft → active → obsolete' },
        { field: 'version', colSpan: 1, helpText: 'Version number (auto-incremented)' },
        { field: 'runAs', colSpan: 1, helpText: 'Execute as system (admin) or user (current user permissions)' },
        { field: 'errorHandling', type: 'composite', colSpan: 2, helpText: 'What to do when a node fails (fail, retry, continue)' },
      ],
    },
  ],
});
