// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { FormLayout } from './view.zod';

/**
 * Form Layout for Page Metadata Type
 */
export const PageFormLayout: FormLayout = {
  tabs: [
    {
      label: 'Basics',
      sections: [
        {
          label: 'Identity',
          fields: [
            { field: 'name', required: true, helpText: 'snake_case route identifier' },
            { field: 'title', required: true, helpText: 'Page title (browser tab + header)' },
            { field: 'description', widget: 'textarea', helpText: 'Page description for SEO' },
          ],
        },
      ],
    },
    {
      label: 'Layout',
      sections: [
        {
          label: 'Components',
          fields: [
            { field: 'components', widget: 'master-detail', required: true, helpText: 'Page layout components (cards, forms, charts)' },
          ],
        },
      ],
    },
    {
      label: 'Advanced',
      sections: [
        {
          label: 'SEO & Meta',
          collapsible: true,
          collapsed: true,
          fields: [
            { field: 'meta', widget: 'object-fields', helpText: 'Meta tags for SEO (keywords, og:tags)' },
          ],
        },
      ],
    },
  ],
};
