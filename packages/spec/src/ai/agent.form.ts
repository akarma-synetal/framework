// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { FormLayout } from '../ui/view.zod';

/**
 * Form Layout for Agent Metadata Type
 */
export const AgentFormLayout: FormLayout = {
  tabs: [
    {
      label: 'Basics',
      sections: [
        {
          label: 'Identity',
          fields: [
            { field: 'name', required: true, helpText: 'snake_case unique identifier' },
            { field: 'label', required: true, helpText: 'Agent display name' },
            { field: 'description', widget: 'textarea', helpText: 'Agent purpose and capabilities' },
          ],
        },
        {
          label: 'Model',
          fields: [
            { field: 'modelProvider', helpText: 'LLM provider (openai, anthropic, azure)' },
            { field: 'modelName', helpText: 'Model identifier (gpt-4, claude-3)' },
            { field: 'temperature', type: 'number', helpText: 'Sampling temperature (0-1)' },
          ],
        },
      ],
    },
    {
      label: 'Prompt',
      sections: [
        {
          label: 'System Prompt',
          fields: [
            { field: 'systemPrompt', widget: 'textarea', required: true, helpText: 'Core instruction for the agent' },
          ],
        },
      ],
    },
    {
      label: 'Tools',
      sections: [
        {
          label: 'Available Tools',
          fields: [
            { field: 'tools', widget: 'string-tags', helpText: 'Tool names agent can invoke' },
          ],
        },
      ],
    },
    {
      label: 'Advanced',
      sections: [
        {
          label: 'Configuration',
          collapsible: true,
          collapsed: true,
          fields: [
            { field: 'maxTokens', type: 'number', helpText: 'Max output tokens' },
            { field: 'topP', type: 'number', helpText: 'Nucleus sampling threshold' },
          ],
        },
      ],
    },
  ],
};
