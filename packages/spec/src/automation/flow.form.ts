// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { FormLayout } from '../ui/view.zod';

/**
 * Form Layout for Flow Metadata Type
 */
export const FlowFormLayout: FormLayout = {
  tabs: [
    {
      label: 'Basics',
      sections: [
        {
          label: 'Identity',
          fields: [
            { field: 'name', required: true, helpText: 'snake_case unique identifier' },
            { field: 'label', required: true, helpText: 'Flow display name' },
            { field: 'description', widget: 'textarea', helpText: 'Flow purpose and trigger conditions' },
          ],
        },
        {
          label: 'Type',
          fields: [
            { field: 'flowType', widget: 'combobox', required: true, helpText: 'autolaunched | screen | schedule' },
            { field: 'triggerOn', widget: 'combobox', helpText: 'Trigger event: create | update | delete' },
          ],
        },
      ],
    },
    {
      label: 'Nodes',
      sections: [
        {
          label: 'Flow Logic',
          fields: [
            { field: 'nodes', widget: 'master-detail', required: true, helpText: 'Flow execution steps (decision, action, loop)' },
          ],
        },
      ],
    },
    {
      label: 'Variables',
      sections: [
        {
          label: 'Flow Variables',
          fields: [
            { field: 'variables', widget: 'master-detail', helpText: 'Variables used in flow execution' },
          ],
        },
      ],
    },
  ],
};
