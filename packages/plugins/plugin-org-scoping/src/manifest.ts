// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Canonical plugin-org-scoping manifest source.
 *
 * Imported by `objectstack.config.ts` (compile-time) and
 * `org-scoping-plugin.ts` (runtime `manifest.register`) so the two
 * registration paths cannot drift.
 */

export const ORG_SCOPING_PLUGIN_ID = 'com.objectstack.plugin-org-scoping';
export const ORG_SCOPING_PLUGIN_VERSION = '1.0.0';

/** This plugin owns no `sys_*` objects — Organization itself lives in `@objectstack/platform-objects`. */
export const orgScopingObjects = [] as const;

/** Manifest header shared by compile-time config and runtime registration. */
export const orgScopingPluginManifestHeader = {
  id: ORG_SCOPING_PLUGIN_ID,
  namespace: 'sys',
  version: ORG_SCOPING_PLUGIN_VERSION,
  type: 'plugin' as const,
  scope: 'system' as const,
  defaultDatasource: 'cloud',
  name: 'Organization Scoping Plugin',
  description:
    'Row-level Organization isolation: auto-stamps `organization_id` on insert from ' +
    '`ExecutionContext.tenantId`, replays seed datasets per new org, and bootstraps a default ' +
    'organization for the first platform admin.',
};
