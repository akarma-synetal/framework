// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { defineForm } from '../ui/view.zod';

/**
 * Form Layout for Object Metadata Type
 */
export const objectForm = defineForm({
  schemaId: 'object',
  type: 'simple',
  sections: [
    {
      label: 'Basics',
      description: 'Identity, labels, and taxonomy.',
      columns: 2,
      fields: [
        { field: 'name', type: 'text', required: true, colSpan: 1, helpText: 'snake_case unique identifier (immutable)' },
        { field: 'label', type: 'text', colSpan: 1, helpText: 'Singular display name (e.g. "Account")' },
        { field: 'pluralLabel', type: 'text', colSpan: 1, helpText: 'Plural display name (e.g. "Accounts")' },
        { field: 'icon', type: 'text', colSpan: 1, helpText: 'Lucide icon name (e.g. "building", "users")' },
        { field: 'description', type: 'textarea', colSpan: 2, helpText: 'Developer documentation' },
        { field: 'tags', widget: 'string-tags', colSpan: 2, helpText: 'Categorization tags (e.g. "sales", "system")' },
        { field: 'active', type: 'boolean', colSpan: 1, helpText: 'Is the object active and usable' },
        { field: 'isSystem', type: 'boolean', colSpan: 1, helpText: 'System object (protected from deletion)' },
        { field: 'abstract', type: 'boolean', colSpan: 1, helpText: 'Abstract base (cannot be instantiated)' },
      ],
    },
    {
      label: 'Fields',
      description: 'Define the data model — each row becomes a column in the database table.',
      fields: [
        {
          field: 'fields',
          widget: 'master-detail',
          required: true,
          helpText: 'Add the columns this object will store',
        },
      ],
    },
    {
      label: 'Capabilities',
      description: 'System features and API exposure.',
      collapsible: true,
      collapsed: true,
      fields: [
        { field: 'capabilities', widget: 'object-fields', helpText: 'Enable/disable system features' },
      ],
    },
    {
      label: 'Advanced',
      description: 'State machines, actions, and storage.',
      collapsible: true,
      collapsed: true,
      fields: [
        { field: 'datasource', type: 'text', helpText: 'Target datasource ID (default: "default")' },
      ],
    },
  ],
});
