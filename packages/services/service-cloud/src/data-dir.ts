// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Default data-directory resolution.
 *
 * Single source of truth for the on-disk location of the control-plane
 * SQLite file (`control.db`), per-project SQLite files, and InMemoryDriver
 * persistence JSON files. All cloud-stack / runtime-stack code paths
 * resolve their default paths through {@link resolveDefaultDataDir} so
 * that the same precedence and serverless fallback applies everywhere.
 *
 * Resolution order:
 *
 *   1. `OS_DATA_DIR` environment variable (explicit override — wins always).
 *   2. `<cwd>/.objectstack/data` on a writable filesystem (the default for
 *      `objectstack dev`, `objectstack serve`, Docker, bare metal, …).
 *   3. `<os.tmpdir()>/.objectstack/data` when running on a serverless
 *      platform with a read-only application bundle (Vercel, AWS Lambda,
 *      Netlify Functions, Cloudflare Workers Node compat). A one-time
 *      warning is emitted because `/tmp` is ephemeral — production
 *      deployments must configure a real database via
 *      `OS_CONTROL_DATABASE_URL` (and `OS_DATABASE_URL` for project data).
 *
 * Centralising this logic prevents the "ENOENT: mkdir '/var/task/.objectstack'"
 * class of cold-start failures on serverless without forcing every caller
 * to re-implement detection.
 */

import { resolve as resolvePath } from 'node:path';
import { tmpdir } from 'node:os';

let _warned = false;

/**
 * Returns `true` when the current process is running on a serverless
 * platform whose application bundle is a read-only filesystem. The set
 * of detected platforms intentionally matches the ones where ObjectStack
 * is regularly deployed today; new platforms can be added via the
 * `OS_READONLY_FS=1` escape hatch.
 */
export function isServerlessReadOnlyFs(env: NodeJS.ProcessEnv = process.env): boolean {
    if (env.OS_READONLY_FS && ['1', 'true', 'yes', 'on'].includes(env.OS_READONLY_FS.trim().toLowerCase())) {
        return true;
    }
    // Vercel sets VERCEL=1 in all build & runtime environments.
    if (env.VERCEL === '1') return true;
    // AWS Lambda & Lambda@Edge.
    if (env.AWS_LAMBDA_FUNCTION_NAME) return true;
    // Netlify Functions.
    if (env.NETLIFY === 'true' || env.NETLIFY_DEV) return true;
    return false;
}

/**
 * Resolve the canonical default data directory for SQLite / file-backed
 * driver persistence. See module docstring for precedence rules.
 *
 * @param env - Optional process-env override, primarily for tests.
 * @returns Absolute filesystem path. Never returns a trailing slash.
 */
export function resolveDefaultDataDir(env: NodeJS.ProcessEnv = process.env): string {
    const explicit = env.OS_DATA_DIR?.trim();
    if (explicit) return resolvePath(explicit);

    if (isServerlessReadOnlyFs(env)) {
        const dir = resolvePath(tmpdir(), '.objectstack/data');
        if (!_warned) {
            _warned = true;
            // eslint-disable-next-line no-console
            console.warn(
                `[objectstack] Detected serverless read-only filesystem. ` +
                `Falling back to ephemeral data directory: ${dir}. ` +
                `Set OS_CONTROL_DATABASE_URL (and OS_DATABASE_URL for project data) ` +
                `to a persistent database (libsql://, postgres://, mysql://, …) for production.`,
            );
        }
        return dir;
    }

    return resolvePath(process.cwd(), '.objectstack/data');
}

/**
 * Test-only helper: reset the one-shot warning latch so test suites can
 * assert the warning is emitted exactly once per process.
 *
 * @internal
 */
export function __resetDataDirWarningForTests(): void {
    _warned = false;
}
