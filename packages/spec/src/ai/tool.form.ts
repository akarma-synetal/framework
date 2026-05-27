// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { defineForm } from '../ui/view.zod';

/**
 * Tool Metadata Form
 * 
 * Form layout for creating/editing AI tool metadata definitions.
 */
export const toolForm = defineForm({
  schemaId: 'tool',
  type: 'simple',
  sections: [
    {
      label: 'Basics',
      description: 'Tool identity and AI-facing description.',
      columns: 2,
      fields: [
        { field: 'name', required: true, colSpan: 1, helpText: 'Unique identifier (snake_case)' },
        { field: 'label', required: true, colSpan: 1, helpText: 'Display name for Studio UI' },
        { field: 'description', required: true, widget: 'textarea', colSpan: 2, helpText: 'Tell AI when to use this tool — be specific!' },
        { field: 'category', colSpan: 1, helpText: 'Tool category (data, action, flow, integration, etc.)' },
        { field: 'objectName', widget: 'ref:object', colSpan: 1, helpText: 'Related object (if this tool operates on a specific object)' },
        { field: 'active', colSpan: 1, helpText: 'Enable/disable this tool' },
        { field: 'builtIn', colSpan: 1, helpText: 'Platform built-in tool (vs user-defined)' },
      ],
    },
    {
      label: 'Schemas',
      description: 'Inputs the tool accepts and the shape of its output.',
      fields: [
        { field: 'parameters', type: 'composite', required: true, helpText: 'Input parameters — define properties like: {name: {type: "string", description: "..."}}' },
        { field: 'outputSchema', type: 'composite', helpText: 'Output schema for validation (optional)' },
      ],
    },
    {
      label: 'Access & safety',
      description: 'Permissions and confirmation requirements.',
      collapsible: true,
      collapsed: true,
      fields: [
        { field: 'requiresConfirmation', helpText: 'Ask user to approve before executing (for destructive actions)' },
        { field: 'permissions', widget: 'string-tags', helpText: 'Required permissions to use this tool' },
      ],
    },
  ],
});
