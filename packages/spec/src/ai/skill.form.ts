// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { FormLayout } from '../ui/view.zod';

/**
 * Form Layout for Skill Metadata Type
 */
export const SkillFormLayout: FormLayout = {
  tabs: [
    {
      label: 'Basics',
      sections: [
        {
          label: 'Identity',
          fields: [
            { field: 'name', required: true, helpText: 'snake_case unique identifier' },
            { field: 'label', required: true, helpText: 'Skill display name' },
            { field: 'description', widget: 'textarea', required: true, helpText: 'Skill capabilities and use cases' },
          ],
        },
      ],
    },
    {
      label: 'Configuration',
      sections: [
        {
          label: 'Tools & Prompts',
          fields: [
            { field: 'tools', widget: 'string-tags', helpText: 'Tool names included in this skill' },
            { field: 'contextPrompt', widget: 'textarea', helpText: 'Additional context for the agent' },
          ],
        },
      ],
    },
  ],
};
