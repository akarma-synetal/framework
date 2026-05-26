// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Synthetic stack config for `os i18n extract`.
 *
 * Imports every sys_* platform object plus the Setup app's existing
 * translations so that `os i18n extract` (and `os i18n check`) can be
 * pointed at this file via `bundle-require`:
 *
 *   os i18n extract packages/platform-objects/scripts/i18n-extract.config.ts \
 *     --locales=zh-CN,ja-JP,es-ES \
 *     --fill=default \
 *     --out=packages/platform-objects/src/apps/translations
 *
 * The config is **build-time only** — it is not deployed and not used at
 * runtime. The Setup App still ships its own bundle via plugin-auth.
 */

import { defineStack } from '@objectstack/spec';

// ── Identity ──────────────────────────────────────────────────────────────
import {
  SysUser,
  SysSession,
  SysAccount,
  SysVerification,
  SysOrganization,
  SysMember,
  SysInvitation,
  SysTeam,
  SysTeamMember,
  SysDepartment,
  SysDepartmentMember,
  SysApiKey,
  SysTwoFactor,
  SysDeviceCode,
  SysUserPreference,
  SysOauthApplication,
  SysOauthAccessToken,
  SysOauthRefreshToken,
  SysOauthConsent,
  SysJwks,
} from '../src/identity/index.js';

// ── Security ──────────────────────────────────────────────────────────────
import {
  SysRole,
  SysPermissionSet,
  SysUserPermissionSet,
  SysRolePermissionSet,
  SysRecordShare,
  SysSharingRule,
} from '../src/security/index.js';

// ── Audit ─────────────────────────────────────────────────────────────────
import {
  SysAuditLog,
  SysPresence,
  SysActivity,
  SysComment,
  SysAttachment,
  SysNotification,
  SysEmail,
  SysEmailTemplate,
  SysSavedReport,
  SysReportSchedule,
  SysApprovalProcess,
  SysApprovalRequest,
  SysApprovalAction,
  SysJob,
  SysJobRun,
  SysJobQueue,
} from '../src/audit/index.js';

// ── Integration ───────────────────────────────────────────────────────────
import { SysWebhook } from '../src/integration/index.js';

// ── Metadata ──────────────────────────────────────────────────────────────
import { SysMetadataObject, SysMetadataHistoryObject } from '../src/metadata/index.js';

// ── System ────────────────────────────────────────────────────────────────
import { SysSetting, SysSecret, SysSettingAudit } from '../src/system/index.js';

// ── Existing Setup app + dashboards + translations ────────────────────────
import { SETUP_APP } from '../src/apps/setup.app.js';
import {
  SystemOverviewDashboard,
} from '../src/apps/dashboards/index.js';
import { SetupAppTranslations } from '../src/apps/translations/index.js';

export default defineStack({
  name: 'platform-objects-i18n-extract',

  objects: [
    // Identity
    SysUser,
    SysSession,
    SysAccount,
    SysVerification,
    SysOrganization,
    SysMember,
    SysInvitation,
    SysTeam,
    SysTeamMember,
    SysDepartment,
    SysDepartmentMember,
    SysApiKey,
    SysTwoFactor,
    SysDeviceCode,
    SysUserPreference,
    SysOauthApplication,
    SysOauthAccessToken,
    SysOauthRefreshToken,
    SysOauthConsent,
    SysJwks,

    // Security
    SysRole,
    SysPermissionSet,
    SysUserPermissionSet,
    SysRolePermissionSet,
    SysRecordShare,
    SysSharingRule,

    // Audit
    SysAuditLog,
    SysPresence,
    SysActivity,
    SysComment,
    SysAttachment,
    SysNotification,
    SysEmail,
    SysEmailTemplate,
    SysSavedReport,
    SysReportSchedule,
    SysApprovalProcess,
    SysApprovalRequest,
    SysApprovalAction,
    SysJob,
    SysJobRun,
    SysJobQueue,

    // Integration
    SysWebhook,

    // Metadata
    SysMetadataObject,
    SysMetadataHistoryObject,

    // System
    SysSetting,
    SysSecret,
    SysSettingAudit,
  ] as any,

  apps: [SETUP_APP] as any,
  dashboards: [SystemOverviewDashboard] as any,

  translations: [SetupAppTranslations],
});
