// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { Role } from '@objectstack/spec/security';
import type { PermissionSet } from '@objectstack/spec/security';

/**
 * Role hierarchy — Sales Manager > Sales Rep. Exercises the Role form
 * (label, hierarchy parent, sharing).
 */
export const SalesRepRole: Role = {
  name: 'sales_rep',
  label: 'Sales Representative',
  description: 'Front-line sales user — owns accounts and opportunities.',
};

export const SalesManagerRole: Role = {
  name: 'sales_manager',
  label: 'Sales Manager',
  description: 'Sales manager — sees their team plus their own records.',
  parentRole: 'sales_rep',
};

/**
 * Permission set (profile=false) — grants standard CRM access. Exercises
 * the Permission form (object/field-level grids, RLS, tab visibility).
 */
export const SalesUserPermissionSet: PermissionSet = {
  name: 'sales_user_access',
  label: 'Sales User Access',
  description: 'CRUD access to CRM objects for the sales team.',
  isProfile: false,
  objects: [
    {
      object: 'crm_account',
      read: true,
      create: true,
      edit: true,
      delete: false,
    },
    {
      object: 'crm_contact',
      read: true,
      create: true,
      edit: true,
      delete: false,
    },
    {
      object: 'crm_opportunity',
      read: true,
      create: true,
      edit: true,
      delete: true,
    },
  ],
};
