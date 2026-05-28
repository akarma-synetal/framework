// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { Plugin, PluginContext } from '@objectstack/core';
import { claimOrphanOrgRows } from './claim-orphan-org-rows.js';
import { cloneOrgSeedData } from './clone-org-seed-data.js';
import { ensureDefaultOrganization } from './ensure-default-organization.js';
import {
  orgScopingObjects,
  orgScopingPluginManifestHeader,
} from './manifest.js';

export interface OrgScopingPluginOptions {
  /**
   * Whether to auto-create a `Default Organization` (slug `default`)
   * and bind the first platform admin as `owner` when they have zero
   * memberships. Set to `false` for deployments that fully self-manage
   * org provisioning via invitation links or a custom onboarding flow.
   *
   * @default true
   */
  ensureDefaultOrganization?: boolean;
}

/**
 * OrgScopingPlugin
 *
 * Makes `sys_organization` a first-class row-level isolation boundary:
 *
 *   1. **insert auto-stamp** — on every authenticated `insert` whose
 *      target object declares `organization_id`, fill the column from
 *      `ExecutionContext.tenantId`. Without this, freshly-created
 *      rows have `organization_id = NULL` and the default
 *      `tenant_isolation` RLS policy hides them from the very user
 *      who just created them.
 *
 *   2. **per-org seed replay** — after `sys_organization` insert, copy
 *      the artifact's demo seed data into the new org. Three paths
 *      (in order of preference):
 *        a. replay registered `seed-datasets` via the kernel-level
 *           `seed-replayer` callable (set by AppPlugin),
 *        b. for the FIRST org, `claimOrphanOrgRows` adopts any
 *           NULL-org rows a previous inline-seed may have inserted,
 *        c. for SUBSEQUENT orgs, `cloneOrgSeedData` shallow-clones
 *           rows from the very first org (donor-pattern).
 *
 *   3. **default-org bootstrap** — on `kernel:ready` and after every
 *      `sys_user_permission_set` insert, ensure the platform admin has
 *      a Default Organization to operate in (idempotent on slug
 *      `default` + admin's existing memberships).
 *
 * Why split from plugin-security:
 *   - plugin-security is a single-tenant-aware RBAC + RLS engine; it
 *     should not know about Organization-specific seed flows.
 *   - This plugin is purely opt-in: not installing it gives a
 *     single-tenant deployment (no `organization_id` injection, no
 *     per-org seed clone, no default-org bootstrap). plugin-security
 *     detects its presence via `getService('org-scoping')` and adjusts
 *     RLS policy stripping accordingly.
 *
 * Naming note: "org-scoping" deliberately avoids the word "tenant"
 * because in ObjectStack "tenant" already means *physical isolation*
 * (one Environment = one database, per ADR-0002 and driver-turso's
 * multi-tenant router). This plugin is about LOGICAL row-level
 * scoping inside a single database — orthogonal to physical tenancy.
 *
 * Dependencies:
 *   - `objectql` (engine middleware host)
 */
export class OrgScopingPlugin implements Plugin {
  name = 'com.objectstack.org-scoping';
  type = 'standard';
  version = '1.0.0';
  dependencies = ['com.objectstack.engine.objectql'];

  /** Per-object field-name cache; same shape as SecurityPlugin's. */
  private readonly fieldNamesCache = new Map<string, Set<string> | null>();

  private readonly opts: Required<OrgScopingPluginOptions>;

  constructor(options: OrgScopingPluginOptions = {}) {
    this.opts = {
      ensureDefaultOrganization: options.ensureDefaultOrganization !== false,
    };
  }

  async init(ctx: PluginContext): Promise<void> {
    ctx.logger.info('Initializing Org-Scoping Plugin...');
    // Service registration doubles as plugin-security's
    // "multi-tenant mode is on" probe: SecurityPlugin queries
    // `getService('org-scoping')` and keeps wildcard
    // `current_user.organization_id` RLS policies when this returns.
    ctx.registerService('org-scoping', this);

    ctx
      .getService<{ register(m: any): void }>('manifest')
      .register({
        ...orgScopingPluginManifestHeader,
        objects: orgScopingObjects,
      });
    ctx.logger.info('Org-Scoping Plugin initialized');
  }

  async start(ctx: PluginContext): Promise<void> {
    ctx.logger.info('Starting Org-Scoping Plugin...');

    let ql: any;
    let metadata: any;
    try {
      ql = ctx.getService('objectql');
      try {
        metadata = ctx.getService('metadata');
      } catch {
        metadata = undefined;
      }
    } catch {
      ctx.logger.warn(
        'ObjectQL service not available, org-scoping middleware not registered',
      );
      return;
    }
    if (!ql || typeof ql.registerMiddleware !== 'function') {
      ctx.logger.warn(
        'ObjectQL engine does not support middleware, org-scoping middleware not registered',
      );
      return;
    }

    // ── Middleware A: auto-stamp `organization_id` on insert ──────────
    ql.registerMiddleware(async (opCtx: any, next: () => Promise<void>) => {
      if (opCtx.context?.isSystem) return next();
      if (
        opCtx.operation === 'insert' &&
        opCtx.data &&
        typeof opCtx.data === 'object' &&
        !Array.isArray(opCtx.data) &&
        opCtx.context?.tenantId
      ) {
        const fields = await this.getObjectFieldNames(metadata, opCtx.object, ql);
        if (fields && fields.has('organization_id')) {
          const data = opCtx.data as Record<string, unknown>;
          if (data.organization_id == null || data.organization_id === '') {
            data.organization_id = opCtx.context.tenantId;
          }
        }
      }
      await next();
    });

    // ── Middleware B: per-org seed pipeline on sys_organization insert ─
    ql.registerMiddleware(async (opCtx: any, next: () => Promise<void>) => {
      await next();
      if (
        opCtx?.object !== 'sys_organization' ||
        (opCtx?.operation !== 'create' && opCtx?.operation !== 'insert')
      ) {
        return;
      }
      const newOrgId = opCtx?.result?.id ?? opCtx?.data?.id;
      if (!newOrgId) return;

      const kernel: any = (ctx as any).kernel ?? ctx;
      let datasets: any[] | undefined;
      try {
        const raw = kernel?.getService?.('seed-datasets');
        if (Array.isArray(raw) && raw.length > 0) datasets = raw;
      } catch {
        /* service not registered */
      }

      // Count existing orgs to pick the right fallback path.
      let orgCount = 0;
      try {
        const allOrgs = await ql.find(
          'sys_organization',
          { limit: 2, fields: ['id'] },
          { context: { isSystem: true } },
        );
        const list: any[] = Array.isArray(allOrgs)
          ? allOrgs
          : Array.isArray(allOrgs?.records)
            ? allOrgs.records
            : [];
        orgCount = list.length;
      } catch (e) {
        ctx.logger.warn('[org-scoping] failed to count organizations', {
          error: (e as Error).message,
        });
      }

      // Primary path: SeedLoader replay scoped to newOrgId.
      let replayed = false;
      try {
        const replayer: any = kernel?.getService?.('seed-replayer');
        if (typeof replayer === 'function') {
          const summary = await replayer(newOrgId);
          const total = (summary?.inserted ?? 0) + (summary?.updated ?? 0);
          ctx.logger.info(
            `[org-scoping] per-org seed replay for ${newOrgId}: +${summary?.inserted ?? 0} inserted, ${summary?.updated ?? 0} updated, ${summary?.errors?.length ?? 0} error(s)`,
            {
              organizationId: newOrgId,
              errors: summary?.errors?.slice?.(0, 5),
            },
          );
          if (total > 0) replayed = true;
        } else if (datasets) {
          ctx.logger.warn(
            '[org-scoping] per-org seed: datasets present but no replayer registered',
            { organizationId: newOrgId },
          );
        }
      } catch (e) {
        ctx.logger.warn(
          '[org-scoping] per-org seed replay failed, falling back',
          { organizationId: newOrgId, error: (e as Error).message },
        );
      }
      if (replayed) return;

      // Fallback A: legacy claim for first org.
      if (orgCount === 1) {
        try {
          const claims = await claimOrphanOrgRows(ql, newOrgId, { logger: ctx.logger });
          if (claims.length > 0) {
            const total = claims.reduce((s, c) => s + c.count, 0);
            ctx.logger.info(
              `[org-scoping] claimed ${total} orphan seed row(s) for first organization ${newOrgId}`,
              { breakdown: claims },
            );
            return;
          }
        } catch (e) {
          ctx.logger.warn('[org-scoping] claim-orphan-org-rows failed', {
            error: (e as Error).message,
          });
        }
      }

      // Fallback B: clone from donor org for subsequent orgs.
      if (orgCount > 1) {
        try {
          const summary = await cloneOrgSeedData(ql, newOrgId, { logger: ctx.logger });
          if (summary.length > 0) {
            const total = summary.reduce((s, c) => s + c.count, 0);
            ctx.logger.info(
              `[org-scoping] cloned ${total} seed row(s) for new organization ${newOrgId}`,
              { breakdown: summary },
            );
          }
        } catch (e) {
          ctx.logger.warn('[org-scoping] clone-org-seed-data failed', {
            organizationId: newOrgId,
            error: (e as Error).message,
          });
        }
      }
    });

    // ── Default-org bootstrap on kernel:ready + on admin grant ────────
    if (this.opts.ensureDefaultOrganization) {
      const runEnsure = async () => {
        try {
          const res = await ensureDefaultOrganization(ql, { logger: ctx.logger });
          if (res.defaultOrgCreated) {
            ctx.logger.info(
              `[org-scoping] created Default Organization ${res.defaultOrgId} for platform admin`,
            );
          }
        } catch (e) {
          ctx.logger.warn?.('[org-scoping] ensureDefaultOrganization failed', {
            error: (e as Error).message,
          });
        }
      };
      if (typeof (ctx as any).hook === 'function') {
        (ctx as any).hook('kernel:ready', runEnsure);
      } else {
        void runEnsure();
      }
      // Re-run after every admin grant — handles the "first sign-up
      // promoted to platform admin" case where the kernel:ready hook
      // fired before any user existed.
      ql.registerMiddleware(async (opCtx: any, next: () => Promise<void>) => {
        await next();
        if (
          opCtx?.object === 'sys_user_permission_set' &&
          (opCtx?.operation === 'insert' || opCtx?.operation === 'create')
        ) {
          await runEnsure();
        }
      });
    }

    ctx.logger.info('Org-Scoping middleware registered on ObjectQL engine');
  }

  async destroy(): Promise<void> {
    // No cleanup needed
  }

  /**
   * Resolve the column-name set for an object (mirrors SecurityPlugin's
   * loader so the two plugins behave consistently). Returns `null` if
   * the schema can't be loaded — caller skips injection.
   */
  private async getObjectFieldNames(
    metadata: any,
    objectName: string,
    ql?: any,
  ): Promise<Set<string> | null> {
    if (this.fieldNamesCache.has(objectName)) {
      return this.fieldNamesCache.get(objectName) ?? null;
    }
    const result = await this.loadObjectFieldNames(metadata, objectName, ql);
    if (result) this.fieldNamesCache.set(objectName, result);
    return result;
  }

  private async loadObjectFieldNames(
    metadata: any,
    objectName: string,
    ql?: any,
  ): Promise<Set<string> | null> {
    try {
      let obj: any =
        typeof ql?.getSchema === 'function' ? ql.getSchema(objectName) : null;
      if (!obj || !obj.fields) {
        obj = await metadata?.get?.('object', objectName);
      }
      if (!obj || !obj.fields) return null;
      const set = new Set<string>(['id']);
      if (Array.isArray(obj.fields)) {
        for (const f of obj.fields) {
          if (f?.name) set.add(String(f.name));
        }
      } else if (typeof obj.fields === 'object') {
        for (const key of Object.keys(obj.fields)) {
          set.add(key);
          const v = (obj.fields as Record<string, any>)[key];
          if (v && typeof v === 'object' && v.name) set.add(String(v.name));
        }
      } else {
        return null;
      }
      return set;
    } catch {
      return null;
    }
  }
}
