// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { FormLayout } from '../ui/view.zod';

/**
 * Form Layout for Object Metadata Type
 * 
 * Defines the structured form for creating/editing business object definitions.
 * Aligns with Salesforce Custom Object setup UI.
 */
export const ObjectFormLayout: FormLayout = {
  tabs: [
    {
      label: 'Basics',
      description: 'Identity, labels, and taxonomy.',
      sections: [
        {
          label: 'Identity',
          fields: [
            { field: 'name', required: true, helpText: 'snake_case unique identifier (immutable)' },
            { field: 'label', helpText: 'Singular display name (e.g. "Account")' },
            { field: 'pluralLabel', helpText: 'Plural display name (e.g. "Accounts")' },
            { field: 'icon', helpText: 'Lucide icon name (e.g. "building", "users")' },
          ],
        },
        {
          label: 'Description & Taxonomy',
          fields: [
            { field: 'description', widget: 'textarea', helpText: 'Developer documentation' },
            { field: 'tags', widget: 'string-tags', helpText: 'Categorization tags (e.g. "sales", "system")' },
          ],
        },
        {
          label: 'Status',
          fields: [
            { field: 'active', helpText: 'Is the object active and usable' },
            { field: 'isSystem', helpText: 'System object (protected from deletion)' },
            { field: 'abstract', helpText: 'Abstract base (cannot be instantiated)' },
          ],
        },
      ],
    },
    {
      label: 'Fields',
      description: 'Define the data model.',
      sections: [
        {
          label: 'Fields',
          fields: [
            { 
              field: 'fields', 
              widget: 'master-detail', 
              required: true,
              helpText: 'Field definitions — each row is a column in the database table',
            },
          ],
        },
        {
          label: 'Field Groups',
          collapsible: true,
          collapsed: true,
          fields: [
            { 
              field: 'fieldGroups', 
              widget: 'master-detail',
              helpText: 'Logical groupings for form layout (e.g. "Contact Info", "Address")',
            },
          ],
        },
      ],
    },
    {
      label: 'Capabilities',
      description: 'System features and API exposure.',
      sections: [
        {
          label: 'Core Capabilities',
          fields: [
            { field: 'capabilities', widget: 'object-fields', helpText: 'Enable/disable system features' },
          ],
        },
        {
          label: 'Lifecycle Management',
          fields: [
            { field: 'managedBy', helpText: 'Lifecycle bucket: platform | config | system | append-only | better-auth' },
            { field: 'userActions', widget: 'object-fields', helpText: 'Override default CRUD affordances' },
          ],
        },
      ],
    },
    {
      label: 'Relationships',
      description: 'Master-detail and lookups.',
      sections: [
        {
          label: 'Related Objects',
          fields: [
            { field: 'parent', helpText: 'Parent object for master-detail cascade' },
            { field: 'children', widget: 'string-tags', helpText: 'Child object names' },
          ],
        },
      ],
    },
    {
      label: 'Indexes',
      description: 'Database performance tuning.',
      sections: [
        {
          label: 'Indexes',
          fields: [
            { 
              field: 'indexes', 
              widget: 'master-detail',
              helpText: 'Database indexes for query optimization',
            },
          ],
        },
      ],
    },
    {
      label: 'Validation',
      description: 'Business rules and constraints.',
      sections: [
        {
          label: 'Validation Rules',
          fields: [
            { 
              field: 'validationRules', 
              widget: 'master-detail',
              helpText: 'Custom validation rules (CEL expressions)',
            },
          ],
        },
      ],
    },
    {
      label: 'Sharing',
      description: 'Record-level security.',
      sections: [
        {
          label: 'Sharing Rules',
          fields: [
            { 
              field: 'sharingRules', 
              widget: 'master-detail',
              helpText: 'Row-level security (RLS) policies',
            },
          ],
        },
        {
          label: 'Org-Wide Defaults',
          collapsible: true,
          collapsed: true,
          fields: [
            { field: 'orgWideDefaults', widget: 'object-fields', helpText: 'Default access levels' },
          ],
        },
      ],
    },
    {
      label: 'Advanced',
      description: 'State machines, actions, and storage.',
      sections: [
        {
          label: 'State Machine',
          collapsible: true,
          collapsed: true,
          fields: [
            { field: 'stateMachine', widget: 'object-fields', helpText: 'Workflow state machine definition' },
          ],
        },
        {
          label: 'Actions',
          collapsible: true,
          collapsed: true,
          fields: [
            { field: 'actions', widget: 'master-detail', helpText: 'Custom actions for this object' },
          ],
        },
        {
          label: 'Storage',
          collapsible: true,
          collapsed: true,
          fields: [
            { field: 'datasource', helpText: 'Target datasource ID (default: "default")' },
            { field: 'systemFields', widget: 'object-fields', helpText: 'System field auto-injection config' },
          ],
        },
      ],
    },
  ],
};
