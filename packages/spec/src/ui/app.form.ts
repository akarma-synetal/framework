// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { defineForm } from './view.zod';

export const appForm = defineForm({
  schemaId: 'app',
  type: 'tabbed',
  sections: [
    {
      label: 'Basics',
      fields: [
        { field: 'name', type: 'text', required: true, helpText: 'snake_case, unique' },
        { field: 'label', type: 'text', required: true },
        { field: 'description', type: 'textarea' },
        { field: 'version', type: 'text' },
        { field: 'icon', type: 'text', helpText: 'Lucide icon name (e.g. "users", "briefcase")' },
        { field: 'active', type: 'boolean' },
        { field: 'isDefault', type: 'boolean', helpText: 'Make this the default app for new users' },
      ],
    },
    {
      label: 'Navigation',
      description: 'Sidebar items and area grouping.',
      fields: [
        { field: 'navigation', widget: 'object-fields', helpText: 'Nav tree — recursive structure' },
        { field: 'areas', widget: 'master-detail', helpText: 'Group items into collapsible areas' },
        { field: 'homePageId', type: 'text', helpText: 'Landing page when app opens' },
        { field: 'mobileNavigation', widget: 'object-fields', helpText: 'Bottom tab bar config for mobile' },
      ],
    },
    {
      label: 'Content',
      description: 'Objects and APIs this app uses.',
      fields: [
        { field: 'objects', widget: 'object-selector', multiple: true, helpText: 'Object names this app exposes' },
        { field: 'apis', widget: 'object-fields', helpText: 'API endpoint definitions' },
        { field: 'defaultAgent', type: 'text', helpText: 'AI agent for the ambient assistant button' },
      ],
    },
    {
      label: 'Branding',
      fields: [{ field: 'branding', widget: 'object-fields', helpText: 'Primary/secondary colors, logo, theme' }],
    },
    {
      label: 'Access & sharing',
      fields: [
        { field: 'requiredPermissions', widget: 'string-tags', helpText: 'Permissions needed to access this app' },
        { field: 'sharing', widget: 'object-fields', helpText: 'Public/internal/restricted access control' },
        { field: 'embed', widget: 'object-fields', helpText: 'iFrame embed configuration' },
        { field: 'aria', widget: 'object-fields', helpText: 'Accessibility labels' },
      ],
    },
  ],
});
