// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { z } from 'zod';
import { lazySchema } from '../shared/lazy-schema';

/**
 * # Project Protocol (dev-workspace / source-of-truth) — Phase 5 / forward-looking
 *
 * As of ADR-0006 v3 the name **Project** has been reassigned. It no longer
 * refers to the runtime container (that is now {@link ./environment.zod.ts}
 * `Environment`). A **Project** is reserved for the future *source-of-truth
 * dev workspace* concept — analogous to a git repository:
 *
 * - **Project** (`sys_project`) — identity row that will own branches,
 *   revisions and access control. Metadata authored here will publish into
 *   compiled artifacts and deploy to one or more {@link Environment}s.
 * - **ProjectBranch** (`sys_project_branch`) — long-lived branch
 *   (production/staging/preview/sandbox) of a project.
 * - **ProjectRevision** (`sys_project_revision`) — immutable per-publish
 *   history of authored metadata (distinct from
 *   `sys_environment_revision`, which is the deploy-target history that the
 *   CLI `publish` flow writes today).
 *
 * **Status:** Phase 5 has not started. No `sys_project*` ObjectSchemas are
 * registered in `service-tenant` today; the corresponding tables do not
 * exist. The CLI deploy flow currently writes only `sys_environment_revision`.
 * The schemas below describe the *target shape* so SDK consumers can plan
 * forward without importing service code.
 */

// ---------------------------------------------------------------------------
// Project (dev-workspace) — identity
// ---------------------------------------------------------------------------

/**
 * Project lifecycle status.
 */
export const ProjectStatusSchema = lazySchema(() => z
  .enum(['active', 'archived', 'failed'])
  .describe('Project lifecycle status'));

export type ProjectStatus = z.infer<typeof ProjectStatusSchema>;

/**
 * Project — the source-of-truth dev workspace for a group of metadata.
 *
 * One row per logical project in the Control Plane. The project itself is
 * an identity record; metadata content lives on {@link ProjectBranch} heads
 * and is snapshotted by {@link ProjectRevision}.
 */
export const ProjectSchema = lazySchema(() => z.object({
  /** UUID of the project (stable, never reused). */
  id: z.string().uuid().describe('UUID of the project (stable, never reused)'),

  /** Organization that owns this project. */
  organizationId: z.string().describe('Organization that owns this project'),

  /** Display name shown in Studio and APIs. */
  displayName: z.string().min(1).describe('Display name shown in Studio and APIs'),

  /**
   * Optional human description of what this project contains
   * (rendered as the README on the Studio project page).
   */
  description: z.string().optional().describe('Optional human description'),

  /** Project lifecycle status. */
  status: ProjectStatusSchema.default('active').describe('Project lifecycle status'),

  /** User ID that created the project. */
  createdBy: z.string().describe('User ID that created the project'),

  /** Creation timestamp (ISO-8601). */
  createdAt: z.string().datetime().describe('Creation timestamp (ISO-8601)'),

  /** Last update timestamp (ISO-8601). */
  updatedAt: z.string().datetime().describe('Last update timestamp (ISO-8601)'),

  /** Free-form metadata (tags, feature flags, …). */
  metadata: z.record(z.string(), z.unknown()).optional().describe('Free-form metadata'),
}));

export type Project = z.infer<typeof ProjectSchema>;

// ---------------------------------------------------------------------------
// ProjectBranch — long-lived branch/environment of a project
// ---------------------------------------------------------------------------

/**
 * Kind of a long-lived project branch — promotion target / preview / sandbox.
 */
export const ProjectBranchKindSchema = lazySchema(() => z
  .enum(['production', 'staging', 'preview', 'sandbox'])
  .describe('Project branch kind'));

export type ProjectBranchKind = z.infer<typeof ProjectBranchKindSchema>;

/**
 * Project branch lifecycle status.
 */
export const ProjectBranchStatusSchema = lazySchema(() => z
  .enum(['active', 'provisioning', 'paused', 'archived', 'failed'])
  .describe('Project branch lifecycle status'));

export type ProjectBranchStatus = z.infer<typeof ProjectBranchStatusSchema>;

/**
 * Long-lived branch of a project.
 *
 * Each branch carries its own metadata head and may bind to its own
 * physical database (for branch-isolated previews). Branches share
 * ownership / billing / access control with the parent project.
 *
 * Unique by `(projectId, name)`.
 */
export const ProjectBranchSchema = lazySchema(() => z.object({
  /** UUID of the branch (stable, never reused). */
  id: z.string().uuid().describe('UUID of the branch'),

  /** Parent project this branch belongs to. */
  projectId: z.string().uuid().describe('Parent project this branch belongs to'),

  /** Machine name (snake_case). Unique within project. */
  name: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9][a-z0-9._/-]{0,99}$/)
    .describe('Machine name (snake_case-ish slug, unique within project)'),

  /** Display name shown in Studio and APIs. */
  displayName: z.string().min(1).max(255).describe('Display name'),

  /** Branch kind. */
  kind: ProjectBranchKindSchema.default('preview').describe('Branch kind'),

  /** Whether this is the project's default branch (typically the production branch). */
  isDefault: z.boolean().default(false).describe('Whether this is the default branch'),

  /** Branch lifecycle status. */
  status: ProjectBranchStatusSchema.default('active').describe('Branch lifecycle status'),

  /**
   * Optional data-plane driver key. Inherits from the parent project (or the
   * provisioning service default) when blank.
   */
  databaseDriver: z.string().optional().describe('Data-plane driver key (inherits when blank)'),

  /**
   * Optional connection URL for the branch's own physical database.
   * Used to give preview branches an isolated DB.
   * Sensitive — admin-only field.
   */
  databaseUrl: z.string().optional().describe('Physical connection URL for this branch (sensitive)'),

  /**
   * For `kind = 'preview'`: the git ref / PR identifier this branch shadows
   * (used by GitHub/GitLab preview integrations).
   */
  sourceRef: z.string().optional().describe('Git ref / PR identifier this preview branch shadows'),

  /** Creation timestamp (ISO-8601). */
  createdAt: z.string().datetime().describe('Creation timestamp (ISO-8601)'),

  /** Last update timestamp (ISO-8601). */
  updatedAt: z.string().datetime().describe('Last update timestamp (ISO-8601)'),
}));

export type ProjectBranch = z.infer<typeof ProjectBranchSchema>;

// ---------------------------------------------------------------------------
// ProjectRevision — immutable per-publish history
// ---------------------------------------------------------------------------

/**
 * One row per `objectstack publish`. Records a content-addressable pointer
 * to the compiled artifact stored in `IStorageService` plus provenance.
 *
 * Lifecycle:
 * - `isCurrent = true` for at most one row per project. Activating a
 *   historical revision flips the flag atomically.
 * - Rows are immutable apart from `isCurrent` and `note`.
 * - `storageKey` is content-addressable (`artifacts/<projectId>/<commitId>.json`
 *   by default), so re-publishing identical content is a no-op upload.
 *
 * Unique by `(projectId, commitId)`.
 */
export const ProjectRevisionSchema = lazySchema(() => z.object({
  /** UUID of the revision row. */
  id: z.string().uuid().describe('UUID of the revision row'),

  /** Parent project. */
  projectId: z.string().uuid().describe('Parent project'),

  /**
   * Short content hash of the artifact (sha256 prefix of the canonical body).
   * Unique per project. Twelve-hex prefix by convention; do not collide with
   * branch names (which are slugs).
   */
  commitId: z.string().min(1).max(64).describe('Content-addressable commit id (sha256 prefix)'),

  /** Full sha256 hex digest of the artifact body. */
  checksum: z.string().regex(/^[a-f0-9]{64}$/).optional().describe('Full sha256 digest'),

  /** Key within `IStorageService` (e.g. `artifacts/<projectId>/<commitId>.json`). */
  storageKey: z.string().min(1).max(512).describe('Storage key in IStorageService'),

  /**
   * Adapter id that wrote this artifact (`"local-fs"` | `"file-storage:<service>"`).
   * Diagnostic only.
   */
  storageAdapter: z.string().optional().describe('Storage adapter id (diagnostic)'),

  /** Uncompressed size of the artifact body. */
  sizeBytes: z.number().int().nonnegative().optional().describe('Uncompressed artifact size in bytes'),

  /** Wall-clock time the artifact was produced by `objectstack compile`. */
  builtAt: z.string().datetime().optional().describe('Compile timestamp (ISO-8601)'),

  /** JSON-serialized builder metadata copied from the artifact (cli version, engines, …). */
  builtWith: z.string().optional().describe('Builder metadata (JSON string)'),

  /** User who issued the publish call (when known). */
  publishedBy: z.string().optional().describe('User id who published this revision'),

  /** When the row was created (publish timestamp). */
  publishedAt: z.string().datetime().optional().describe('Publish timestamp (ISO-8601)'),

  /** Optional human note (release name / changelog blurb). */
  note: z.string().max(1024).optional().describe('Optional human note'),

  /** Whether this revision is the active one for the project. */
  isCurrent: z.boolean().default(false).describe('Whether this is the current revision for the project'),

  /**
   * Logical branch this revision belongs to. Default `main`. Slug-shaped.
   * Must not look like a 12-hex commit prefix (would collide with preview URL parsing).
   */
  branch: z
    .string()
    .max(63)
    .regex(/^[a-z0-9][a-z0-9._/-]{0,62}$/)
    .default('main')
    .describe('Logical branch this revision belongs to'),

  /**
   * Whether this revision is the latest published commit on its branch.
   * At most one row per `(projectId, branch)` carries `true`.
   */
  isBranchHead: z.boolean().default(false).describe('Whether this is the head of its branch'),

  /** Creation timestamp (ISO-8601, typically = publishedAt). */
  createdAt: z.string().datetime().describe('Creation timestamp (ISO-8601)'),

  /** Last update timestamp (only `isCurrent` / `note` mutate after creation). */
  updatedAt: z.string().datetime().describe('Last update timestamp (ISO-8601)'),
}));

export type ProjectRevision = z.infer<typeof ProjectRevisionSchema>;

// ---------------------------------------------------------------------------
// Note on migration
// ---------------------------------------------------------------------------
//
// Prior to ADR-0006 v3 this module also exported `ProjectSchema`,
// `ProvisionProjectRequestSchema`, `ProjectCredentialSchema`,
// `ProjectMemberSchema`, `ProjectTypeSchema`, `ProjectStatusSchema` etc.
// All of those have been renamed to `Environment*` and moved to
// `./environment.zod.ts`. There are no deprecated aliases — the dev-workspace
// `Project*` names defined above own this module now, and runtime-container
// consumers must import from `./environment.zod.ts` (or via
// `@objectstack/spec/cloud`, which re-exports both).
