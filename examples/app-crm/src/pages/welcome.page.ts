// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { Page } from '@objectstack/spec/ui';

/**
 * Page — custom welcome page rendered as the CRM app home. Exercises
 * the Page form (template, regions, components, kind).
 */
export const CrmWelcomePage: Page = {
  name: 'crm_welcome',
  label: 'CRM Welcome',
  description: 'Landing page shown when users open the CRM app.',
  type: 'home',
  template: 'header-sidebar-main',
  kind: 'full',
  isDefault: true,
  regions: [
    {
      name: 'header',
      width: 'full',
      components: [
        { type: 'banner', title: 'Welcome to ObjectStack CRM' },
      ],
    },
    {
      name: 'main',
      width: 'full',
      components: [
        { type: 'dashboard', dashboard: 'crm_pipeline' },
      ],
    },
  ],
};
