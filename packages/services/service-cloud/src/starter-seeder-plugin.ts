// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * createStarterSeederPlugin — Marketplace seeding plugin.
 *
 * Ensures one `sys_package` row exists per starter template in the
 * control-plane DB so the Console Marketplace view has something to
 * show. Idempotent — upserts by `manifest_id` and only writes new rows.
 *
 * `sys_package_version` rows (with `manifest_json` snapshot) are NOT
 * created at seed time — the template bundles (e.g. CRM, ~8k lines)
 * are lazy-loaded only when the user clicks Install (see
 * `package-install.ts`). This keeps control-plane cold-start fast.
 *
 * Seeded rows are:
 *   - `is_starter: true` — surfaces in the "Starter Template" filter
 *   - `publisher: 'objectstack'` — first-party
 *   - `visibility: 'marketplace'` — public, installable by any env
 *   - `owner_org_id: '__platform__'` — sentinel for platform-owned
 *
 * The plugin runs in the `start` phase, after the control-plane DB
 * is fully provisioned by `ObjectQLPlugin`.
 */

import type { IDataDriver } from '@objectstack/spec/contracts';
import type { ProjectTemplate } from './multi-project-plugin.js';

type AnyContext = any;

const PLATFORM_OWNER_ORG_ID = '__platform__';
const STARTER_MANIFEST_PREFIX = 'app.objectstack.starter.';

interface SeederConfig {
    templates: Record<string, ProjectTemplate>;
    controlDriverPromise: Promise<{ driver: IDataDriver }>;
}

function nowIso(): string {
    return new Date().toISOString();
}

/**
 * Stable manifest_id for a starter template. Keeps the seeded
 * sys_package row addressable across restarts.
 */
export function starterManifestId(templateId: string): string {
    return `${STARTER_MANIFEST_PREFIX}${templateId}`;
}

export function createStarterSeederPlugin(config: SeederConfig): any {
    return {
        name: 'com.objectstack.cloud.starter-seeder',
        version: '1.0.0',
        init: async (_ctx: AnyContext) => {},
        start: async (ctx: AnyContext) => {
            const templateList = Object.values(config.templates);
            if (templateList.length === 0) {
                ctx.logger?.info?.('[StarterSeeder] No templates configured — skipping seed.');
                return;
            }

            let driver: IDataDriver;
            try {
                ({ driver } = await config.controlDriverPromise);
            } catch (err: any) {
                console.warn('[StarterSeeder] Control driver unavailable — skipping seed:', err?.message ?? err);
                return;
            }

            for (const tpl of templateList) {
                const manifestId = starterManifestId(tpl.id);
                try {
                    // Idempotent upsert: skip if a row with this manifest_id
                    // already exists. We don't UPDATE existing rows because
                    // operators may have edited display_name / description.
                    const existing: any = await (driver as any).findOne?.('sys_package', { where: { manifest_id: manifestId } });
                    if (existing && existing.id) {
                        continue;
                    }
                    const id = `pkg_starter_${tpl.id}`;
                    await (driver as any).create?.('sys_package', {
                        id,
                        created_at: nowIso(),
                        updated_at: nowIso(),
                        manifest_id: manifestId,
                        // owner_org_id intentionally null — platform-seeded.
                        display_name: tpl.label,
                        description: tpl.description,
                        visibility: 'marketplace',
                        category: tpl.category ?? 'starter',
                        is_starter: true,
                        publisher: 'objectstack',
                    });
                    ctx.logger?.info?.(`[StarterSeeder] Seeded starter package: ${tpl.id} (${manifestId})`);
                } catch (err: any) {
                    console.warn(`[StarterSeeder] Failed to seed ${tpl.id}:`, err?.message ?? err);
                }
            }
        },
        stop: async (_ctx: AnyContext) => {},
    };
}
