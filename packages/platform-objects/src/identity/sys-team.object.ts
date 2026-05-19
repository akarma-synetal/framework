// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { ObjectSchema, Field } from '@objectstack/spec/data';

/**
 * sys_team — System Team Object
 *
 * Teams within an organization for fine-grained grouping.
 * Backed by better-auth's organization plugin (teams feature).
 *
 * @namespace sys
 */
export const SysTeam = ObjectSchema.create({
  name: 'sys_team',
  label: 'Team',
  pluralLabel: 'Teams',
  icon: 'users',
  isSystem: true,
  managedBy: 'better-auth',
  description: 'Teams within organizations for fine-grained grouping',
  displayNameField: 'name',
  titleFormat: '{name}',
  compactLayout: ['name', 'organization_id'],

  listViews: {
    by_org: {
      type: 'grid',
      name: 'by_org',
      label: 'By Organization',
      data: { provider: 'object', object: 'sys_team' },
      columns: ['organization_id', 'name', 'created_at', 'updated_at'],
      sort: [{ field: 'organization_id', order: 'asc' }, { field: 'name', order: 'asc' }],
      grouping: { fields: [{ field: 'organization_id', order: 'asc', collapsed: false }] },
      pagination: { pageSize: 100 },
    },
    all_teams: {
      type: 'grid',
      name: 'all_teams',
      label: 'All',
      data: { provider: 'object', object: 'sys_team' },
      columns: ['name', 'organization_id', 'created_at', 'updated_at'],
      sort: [{ field: 'name', order: 'asc' }],
      pagination: { pageSize: 50 },
    },
  },

  fields: {
    // ── Identity ─────────────────────────────────────────────────
    name: Field.text({
      label: 'Name',
      required: true,
      searchable: true,
      maxLength: 255,
      group: 'Identity',
    }),

    organization_id: Field.lookup('sys_organization', {
      label: 'Organization',
      required: true,
      description: 'Parent organization for this team',
      group: 'Identity',
    }),

    // ── System ───────────────────────────────────────────────────
    id: Field.text({
      label: 'Team ID',
      required: true,
      readonly: true,
      group: 'System',
    }),

    created_at: Field.datetime({
      label: 'Created At',
      defaultValue: 'NOW()',
      readonly: true,
      group: 'System',
    }),

    updated_at: Field.datetime({
      label: 'Updated At',
      defaultValue: 'NOW()',
      readonly: true,
      group: 'System',
    }),
  },

  indexes: [
    { fields: ['organization_id'] },
    { fields: ['name', 'organization_id'], unique: true },
  ],

  enable: {
    trackHistory: true,
    searchable: true,
    apiEnabled: true,
    apiMethods: ['get', 'list', 'create', 'update', 'delete'],
    trash: true,
    mru: false,
  },
});
