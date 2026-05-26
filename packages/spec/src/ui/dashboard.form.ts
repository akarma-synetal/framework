// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { defineForm } from './view.zod';

export const dashboardForm = defineForm({
  schemaId: 'dashboard',
  type: 'tabbed',
  sections: [
    {
      label: 'Basics',
      fields: [
        { field: 'name', type: 'text', required: true, helpText: 'snake_case unique identifier' },
        { field: 'label', type: 'text', required: true, helpText: 'Display name' },
        { field: 'description', type: 'textarea' },
      ],
    },
    {
      label: 'Layout',
      description: 'Grid sizing and refresh cadence.',
      fields: [
        { field: 'columns', type: 'number', helpText: 'Number of grid columns (default 12)' },
        { field: 'gap', type: 'number', helpText: 'Grid gap in Tailwind spacing units' },
        { field: 'refreshInterval', type: 'number', helpText: 'Auto-refresh interval (seconds)' },
        { field: 'header', widget: 'object-fields', helpText: 'Dashboard header config (title, subtitle, actions)' },
      ],
    },
    {
      label: 'Widgets',
      description: 'Cards and charts placed on the grid.',
      fields: [
        { field: 'widgets', widget: 'master-detail', required: true, helpText: 'Dashboard widgets with position and sizing' },
      ],
    },
    {
      label: 'Filters',
      fields: [
        { field: 'dateRange', widget: 'object-fields', helpText: 'Default date range selector' },
        { field: 'globalFilters', widget: 'master-detail', helpText: 'Filters applied to all widgets' },
      ],
    },
    {
      label: 'Advanced',
      fields: [
        { field: 'aria', widget: 'object-fields', helpText: 'Accessibility labels' },
        { field: 'performance', widget: 'object-fields', helpText: 'Caching and optimization config' },
      ],
    },
  ],
});
