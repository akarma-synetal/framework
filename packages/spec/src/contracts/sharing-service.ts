// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * @objectstack/spec/contracts/sharing-service
 *
 * Cross-package contract for record-level sharing enforcement.
 *
 * Two concerns live behind this interface:
 *
 *   1. **Filter contribution** — `buildReadFilter()` returns a
 *      `FilterCondition` (or `null` for "no restriction") that the
 *      engine middleware AND-s into every read query. Callers must
 *      treat `null` as "object is public, do not filter".
 *
 *   2. **Per-record gating** — `canEdit()` answers the access question
 *      for `update` / `delete` operations. Returns `true` when the
 *      caller may modify the record, `false` otherwise.
 *
 * Manual share CRUD is exposed via `grant()`, `revoke()`, and
 * `listShares()`. The REST layer wires these to
 * `/data/:object/:id/shares`.
 *
 * The default implementation lives in `@objectstack/plugin-sharing`.
 */

/** Recipient categories — mirrors `ShareRecipientType` in spec/security. */
export type ShareRecipientType =
  | 'user'
  | 'group'
  | 'role'
  | 'role_and_subordinates'
  | 'guest';

/** Access level on a single record. */
export type ShareAccessLevel = 'read' | 'edit' | 'full';

/** Why a share row exists (used by the rule evaluator to reconcile). */
export type ShareSource = 'manual' | 'rule' | 'team' | 'inherited';

/** Single row from `sys_record_share` projected for cross-package callers. */
export interface RecordShare {
  id: string;
  object_name: string;
  record_id: string;
  recipient_type: ShareRecipientType;
  recipient_id: string;
  access_level: ShareAccessLevel;
  source: ShareSource;
  source_id?: string;
  granted_by?: string;
  reason?: string;
  created_at?: string;
  updated_at?: string;
}

/** Input for `ISharingService.grant`. */
export interface GrantShareInput {
  object: string;
  recordId: string;
  recipientType?: ShareRecipientType;
  recipientId: string;
  accessLevel?: ShareAccessLevel;
  source?: ShareSource;
  sourceId?: string;
  reason?: string;
}

/** Minimal execution-context shape the service needs from callers. */
export interface SharingExecutionContext {
  userId?: string;
  tenantId?: string;
  roles?: string[];
  permissions?: string[];
  isSystem?: boolean;
}

/**
 * Public contract.
 *
 * Implementations should treat `context.isSystem === true` as a
 * complete bypass (no filter, every `canEdit` returns `true`) so that
 * platform-internal writers (audit, migrations, the sharing plugin
 * itself) cannot deadlock on their own enforcement.
 */
export interface ISharingService {
  /**
   * Return a filter condition that restricts a `find` to rows the
   * principal in `context` can see for `object`. Return `null` when no
   * restriction applies (public object, system context, no userId).
   */
  buildReadFilter(
    object: string,
    context: SharingExecutionContext,
  ): Promise<unknown | null>;

  /**
   * Return `true` when the principal in `context` may modify the
   * record `(object, recordId)`. Owner-only for `private` / `read`
   * objects; always true for `public` objects.
   */
  canEdit(
    object: string,
    recordId: string,
    context: SharingExecutionContext,
  ): Promise<boolean>;

  /** Create or upsert a manual share row. */
  grant(input: GrantShareInput, context: SharingExecutionContext): Promise<RecordShare>;

  /** Remove a share row by id. No-op when not found. */
  revoke(shareId: string, context: SharingExecutionContext): Promise<void>;

  /** List all share rows attached to `(object, recordId)`. */
  listShares(
    object: string,
    recordId: string,
    context: SharingExecutionContext,
  ): Promise<RecordShare[]>;
}
