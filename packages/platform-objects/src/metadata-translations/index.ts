// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { TranslationBundle } from '@objectstack/spec/system';
import { en } from './en.js';
import { zhCN } from './zh-CN.js';
import { jaJP } from './ja-JP.js';
import { esES } from './es-ES.js';

/**
 * `MetadataFormsTranslations`
 *
 * Platform-default i18n bundle for the metadata-type configuration forms
 * (object / field / agent / flow / view) shipped from `@objectstack/spec`.
 *
 * Consumed by `PlatformObjectsPlugin` at `kernel:ready` and merged into
 * the kernel's i18n service. The REST layer's `translateMetaTypesResponse`
 * helper then resolves `metadataForms.<type>.{sections,fields}.*` paths
 * against this bundle when shipping `GET /meta` payloads.
 *
 * Supported locales: en, zh-CN, ja-JP, es-ES. Non-zh-CN slots are
 * currently placeholders and fall back to the inline English literals
 * on each `*.form.ts` schema until populated.
 */
export const MetadataFormsTranslations: TranslationBundle = {
  en,
  'zh-CN': zhCN,
  'ja-JP': jaJP,
  'es-ES': esES,
};
