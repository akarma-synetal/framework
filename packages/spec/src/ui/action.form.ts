// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { FormLayout } from './view.zod';

/**
 * Form Layout for Action Metadata Type
 */
export const ActionFormLayout: FormLayout = {
  tabs: [
    {
      label: 'Basics',
      sections: [
        {
          label: 'Identity',
          fields: [
            { field: 'name', required: true, helpText: 'snake_case unique identifier' },
            { field: 'label', required: true, helpText: 'Display label for the action button' },
            { field: 'icon', helpText: 'Lucide icon name (e.g. "check", "x", "send")' },
          ],
        },
        {
          label: 'Type & Target',
          fields: [
            { field: 'type', required: true, widget: 'combobox', helpText: 'Action type: script | url | modal | flow | api | form' },
            { field: 'target', helpText: 'Handler reference (URL, flow name, modal name, endpoint)' },
          ],
        },
      ],
    },
    {
      label: 'Placement',
      sections: [
        {
          label: 'Locations',
          fields: [
            { field: 'objectName', helpText: 'Target object (action auto-merges into object.actions)' },
            { field: 'locations', widget: 'string-tags', helpText: 'list_toolbar | list_item | record_header | record_more | global_nav' },
            { field: 'component', widget: 'combobox', helpText: 'Visual style: button | icon | menu | group' },
          ],
        },
      ],
    },
    {
      label: 'Parameters',
      sections: [
        {
          label: 'Params',
          fields: [
            { field: 'params', widget: 'master-detail', helpText: 'Input parameters for action dialog' },
          ],
        },
      ],
    },
    {
      label: 'Behavior',
      sections: [
        {
          label: 'Confirmation',
          fields: [
            { field: 'confirmTitle', helpText: 'Confirmation dialog title' },
            { field: 'confirmMessage', helpText: 'Confirmation dialog message' },
          ],
        },
        {
          label: 'Visibility',
          fields: [
            { field: 'visibleOn', helpText: 'CEL expression for conditional visibility' },
            { field: 'disabledOn', helpText: 'CEL expression for conditional disable' },
          ],
        },
      ],
    },
    {
      label: 'Advanced',
      sections: [
        {
          label: 'Execution',
          collapsible: true,
          collapsed: true,
          fields: [
            { field: 'async', helpText: 'Execute asynchronously (background job)' },
            { field: 'successMessage', helpText: 'Toast message on success' },
            { field: 'errorMessage', helpText: 'Toast message on error' },
          ],
        },
        {
          label: 'Security',
          collapsible: true,
          collapsed: true,
          fields: [
            { field: 'requiredPermissions', widget: 'string-tags', helpText: 'Required permission set names' },
          ],
        },
      ],
    },
  ],
};
