// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { App } from '@objectstack/spec/ui';

export const CrmApp = App.create({
  name: 'crm_app',
  label: 'CRM',
  icon: 'briefcase',
  branding: {
    primaryColor: '#2563EB',
  },

  navigation: [
    {
      id: 'group_sales',
      type: 'group',
      label: 'Sales',
      icon: 'briefcase',
      children: [
        { id: 'nav_accounts', type: 'object', objectName: 'account', label: 'Accounts', icon: 'building' },
        { id: 'nav_contacts', type: 'object', objectName: 'contact', label: 'Contacts', icon: 'user' },
        { id: 'nav_opportunities', type: 'object', objectName: 'opportunity', label: 'Opportunities', icon: 'trending-up' },
      ],
    },
    {
      id: 'group_analytics',
      type: 'group',
      label: 'Analytics',
      icon: 'chart-bar',
      children: [
        { id: 'nav_pipeline_dashboard', type: 'dashboard', dashboardName: 'pipeline_dashboard', label: 'Pipeline', icon: 'layout-dashboard' },
      ],
    },
  ],
});
