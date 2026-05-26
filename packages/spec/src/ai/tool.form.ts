// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { FormLayout } from '../ui/view.zod';

/**
 * Form Layout for Tool Metadata Type
 */
export const ToolFormLayout: FormLayout = {
  tabs: [
    {
      label: 'Basics',
      sections: [
        {
          label: 'Identity',
          fields: [
            { field: 'name', required: true, helpText: 'snake_case unique identifier' },
            { field: 'label', required: true, helpText: 'Tool display name' },
            { field: 'description', widget: 'textarea', required: true, helpText: 'What does this tool do? (shown to LLM)' },
          ],
        },
      ],
    },
    {
      label: 'Parameters',
      sections: [
        {
          label: 'Input Schema',
          fields: [
            { field: 'parameters', widget: 'object-fields', required: true, helpText: 'JSON Schema defining tool inputs' },
          ],
        },
      ],
    },
    {
      label: 'Implementation',
      sections: [
        {
          label: 'Handler',
          fields: [
            { field: 'execute', widget: 'textarea', required: true, helpText: 'JavaScript function body' },
          ],
        },
      ],
    },
  ],
};
