/**
 * Package lifecycle-state persistence (local-first).
 *
 * The in-memory {@link SchemaRegistry} loses package enable/disable state on
 * every restart because packages are re-registered from the compiled artifact
 * (always enabled). This store persists the *runtime lifecycle state* (which
 * packages an operator has disabled) outside the artifact so the choice
 * survives restarts.
 *
 * Storage is a small JSON file under the ObjectStack home directory, keyed by
 * environment id so disables never leak between environments (e.g. `env_local`
 * vs staging):
 *
 *   <OS_HOME>/package-state/<environmentId>.json   →  { "disabled": ["id", …] }
 *
 * This is intentionally a flat file rather than a `sys_*` object: package
 * lifecycle state is runtime/operational state, not project metadata, and the
 * local-first install path already keeps per-environment data under OS_HOME.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { resolveObjectStackHome } from './standalone-stack.js';

const DEFAULT_ENVIRONMENT_ID = 'default';

interface PackageStateFile {
    disabled?: string[];
}

function sanitizeEnvironmentId(environmentId?: string): string {
    const raw = (environmentId ?? process.env.OS_ENVIRONMENT_ID ?? DEFAULT_ENVIRONMENT_ID).trim();
    const safe = raw.replace(/[^a-zA-Z0-9._-]/g, '_');
    return safe.length > 0 ? safe : DEFAULT_ENVIRONMENT_ID;
}

function stateFilePath(environmentId?: string): string {
    return join(resolveObjectStackHome(), 'package-state', `${sanitizeEnvironmentId(environmentId)}.json`);
}

function readState(environmentId?: string): PackageStateFile {
    const file = stateFilePath(environmentId);
    if (!existsSync(file)) return {};
    try {
        const parsed = JSON.parse(readFileSync(file, 'utf8')) as PackageStateFile;
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
        // Corrupt/partial file — treat as empty rather than crashing boot.
        return {};
    }
}

function writeState(environmentId: string | undefined, state: PackageStateFile): void {
    const file = stateFilePath(environmentId);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
}

/** Set of package ids currently persisted as disabled for the environment. */
export function loadDisabledPackageIds(environmentId?: string): Set<string> {
    const disabled = readState(environmentId).disabled;
    return new Set(Array.isArray(disabled) ? disabled.filter((id) => typeof id === 'string') : []);
}

/**
 * Persist the disabled/enabled state of a single package. Best-effort: failures
 * are surfaced to the caller so the HTTP layer can log, but disabling already
 * took effect in-memory regardless.
 */
export function setPackageDisabled(environmentId: string | undefined, packageId: string, disabled: boolean): void {
    const ids = loadDisabledPackageIds(environmentId);
    if (disabled) ids.add(packageId);
    else ids.delete(packageId);
    writeState(environmentId, { disabled: Array.from(ids).sort() });
}
