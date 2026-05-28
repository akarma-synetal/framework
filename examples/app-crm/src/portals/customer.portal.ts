// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { Portal } from '@objectstack/spec';

/**
 * Customer Self-Service Portal — external users can view their account,
 * submit activities, and track open opportunities without a full Studio login.
 *
 * Demonstrates: kind discriminator, profiles, navigation items, anonymous
 * entry with rate-limiting, SEO metadata, and magic-link auth mode.
 */
export const CustomerPortal: Portal = {
  kind: 'portal',
  id: 'customer_self_service',
  label: 'Customer Self-Service Portal',
  description: 'External portal for customers to track their account and support activities.',
  routePrefix: '/portal/customer',
  layout: 'minimal',
  authMode: 'magic-link',
  locale: 'auto',
  profiles: ['customer_portal_user'],
  seo: {
    title: 'Customer Portal — CRM Example',
    description: 'Track your account, opportunities, and support activities.',
    robots: 'noindex',
  },
  navigation: [
    {
      type: 'view',
      id: 'my_activities',
      label: 'My Activities',
      icon: 'calendar',
      order: 1,
      viewRef: 'crm_activity.activity_grid',
    },
    {
      type: 'view',
      id: 'my_account',
      label: 'My Account',
      icon: 'building',
      order: 2,
      viewRef: 'crm_account.account_list',
    },
    {
      type: 'url',
      id: 'knowledge_base',
      label: 'Knowledge Base',
      icon: 'book-open',
      order: 3,
      url: 'https://docs.example.com',
      target: '_blank',
    },
  ],
  anonymousEntry: {
    routes: [
      {
        path: '/contact',
        actionRef: 'crm_lead.create',
        rateLimit: { rule: '5/hour/ip', scope: 'ip' },
        captcha: true,
        bindIdentityFromField: 'email',
      },
    ],
    defaultRateLimit: { rule: '100/day/ip', scope: 'ip' },
  },
  defaultRoute: {
    viewRef: 'crm_activity.activity_grid',
  },
  embeddable: false,
  active: true,
};
