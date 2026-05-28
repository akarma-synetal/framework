// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { defineStack } from '@objectstack/spec';
import { orgScopingObjects, orgScopingPluginManifestHeader } from './src/manifest';

export default defineStack({
  manifest: orgScopingPluginManifestHeader,
  objects: orgScopingObjects as any,
});
