// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { defineForm } from './view.zod';

export const appForm = defineForm({
  schemaId: 'app',
  type: 'tabbed',
  sections: [
    {
      label: 'Basics',
      fields: [
        { field: 'name', required: true, helpText: 'snake_case, unique' },
        { field: 'label', required: true },
        { field: 'description' },
        { field: 'version' },
        { field: 'icon', helpText: 'Lucide icon name (e.g. "users", "briefcase")' },
        { field: 'active' },
        { field: 'isDefault', helpText: 'Make this the default app for new users' },
      ],
    },
    {
      label: 'Navigation',
      description: 'Sidebar items and area grouping.',
      fields: [
        { field: 'navigation', widget: 'master-detail', helpText: 'Recursive nav tree — falls back to JSON until tree-builder ships' },
        { field: 'areas', widget: 'master-detail' },
        { field: 'homePageId' },
        { field: 'mobileNavigation', widget: 'object-fields' },
      ],
    },
    {
      label: 'Content',
      description: 'Objects and APIs this app uses.',
      fields: [
        { field: 'objects', widget: 'json', helpText: 'String[] or object[]; raw JSON for now' },
        { field: 'apis', widget: 'json' },
        { field: 'defaultAgent', helpText: 'AI agent for the ambient assistant button' },
      ],
    },
    {
      label: 'Branding',
      fields: [{ field: 'branding', widget: 'object-fields' }],
    },
    {
      label: 'Access & sharing',
      fields: [
        { field: 'requiredPermissions', widget: 'string-tags' },
        { field: 'sharing', widget: 'object-fields' },
        { field: 'embed', widget: 'object-fields' },
        { field: 'aria', widget: 'object-fields' },
      ],
    },
  ],
});
