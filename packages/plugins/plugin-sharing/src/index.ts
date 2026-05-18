// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * @objectstack/plugin-sharing
 *
 * Record-level sharing for ObjectStack. Implements `ISharingService`
 * and installs an engine middleware that enforces
 * `object.sharingModel` (`private` / `read`) against the
 * authenticated execution context.
 */

export { SysRecordShare } from '@objectstack/platform-objects/security';
export {
  SharingService,
  type SharingEngine,
  type SharingServiceOptions,
} from './sharing-service.js';
export {
  SharingServicePlugin,
  buildSharingMiddleware,
  type SharingPluginOptions,
} from './sharing-plugin.js';
export type {
  ISharingService,
  RecordShare,
  GrantShareInput,
  SharingExecutionContext,
  ShareAccessLevel,
  ShareRecipientType,
  ShareSource,
} from '@objectstack/spec/contracts';
