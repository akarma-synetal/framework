// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { FormLayout } from '../ui/view.zod';

/**
 * Form Layout for Workflow Metadata Type
 */
export const WorkflowFormLayout: FormLayout = {
  tabs: [
    {
      label: 'Basics',
      sections: [
        {
          label: 'Identity',
          fields: [
            { field: 'name', required: true, helpText: 'snake_case unique identifier' },
            { field: 'label', required: true, helpText: 'Workflow display name' },
            { field: 'description', widget: 'textarea', helpText: 'Workflow purpose' },
          ],
        },
      ],
    },
    {
      label: 'Rules',
      sections: [
        {
          label: 'Workflow Rules',
          fields: [
            { field: 'rules', widget: 'master-detail', required: true, helpText: 'IF/THEN rules (criteria → actions)' },
          ],
        },
      ],
    },
  ],
};
