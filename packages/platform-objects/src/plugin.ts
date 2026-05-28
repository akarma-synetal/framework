// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { SetupAppTranslations } from './apps/translations/index.js';
import { MetadataFormsTranslations } from './metadata-translations/index.js';

/**
 * `PlatformObjectsPlugin`
 *
 * Owns the runtime contribution of platform-default translation bundles
 * into the kernel's i18n service. Replaces the historical detour of
 * piggy-backing on `plugin-auth` to load these bundles — translations
 * belong with the package that defines them.
 *
 * Loaded on `kernel:ready` so the i18n service plugin (which may register
 * later than ordinary services) is guaranteed to be present.
 *
 * Bundles contributed:
 *  - `SetupAppTranslations`        — the static Setup App + sys_* dashboards.
 *  - `MetadataFormsTranslations`   — `metadataForms.*` for object/field/
 *                                    agent/flow/view configuration forms.
 *
 * Gracefully degrades when no i18n service is registered (e.g. lean
 * test / MSW kernels): the UI then falls back to the inline literals
 * carried on each App / Dashboard / `*.form.ts` schema.
 *
 * Structurally typed against `@objectstack/core`'s `Plugin` contract so
 * this package does not need to depend on the kernel at compile time.
 */
export class PlatformObjectsPlugin {
  readonly name = 'com.objectstack.platform-objects';
  readonly type = 'standard';
  readonly version = '1.0.0';
  readonly dependencies: string[] = [];

  async init(_ctx: any): Promise<void> {
    // No-op: this plugin only contributes translations on `kernel:ready`.
    // The init hook exists to satisfy the kernel's Plugin contract.
  }

  async start(ctx: any): Promise<void> {
    ctx?.hook?.('kernel:ready', async () => {
      let i18n: any;
      try {
        i18n = ctx.getService?.('i18n');
      } catch {
        return;
      }
      if (!i18n || typeof i18n.loadTranslations !== 'function') return;

      const bundles: Array<[string, Record<string, unknown>]> = [
        ['Setup', SetupAppTranslations as unknown as Record<string, unknown>],
        ['MetadataForms', MetadataFormsTranslations as unknown as Record<string, unknown>],
      ];

      let loaded = 0;
      for (const [bundleName, bundle] of bundles) {
        for (const [locale, data] of Object.entries(bundle)) {
          if (!data || typeof data !== 'object') continue;
          try {
            i18n.loadTranslations(locale, data as Record<string, unknown>);
            loaded++;
          } catch (err: any) {
            ctx?.logger?.warn?.(
              `[platform-objects] failed to load ${bundleName} translations for '${locale}': ${
                err?.message ?? err
              }`,
            );
          }
        }
      }

      if (loaded > 0) {
        ctx?.logger?.info?.(
          `[platform-objects] contributed platform translations (${loaded} locale entries)`,
        );
      }
    });
  }
}

/** Convenience factory mirroring the rest of the plugin ecosystem. */
export function createPlatformObjectsPlugin(): PlatformObjectsPlugin {
  return new PlatformObjectsPlugin();
}
