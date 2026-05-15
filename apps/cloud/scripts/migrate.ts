// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Out-of-band schema migration for ObjectStack Cloud.
 *
 * Why this exists
 * ───────────────
 * The Cloudflare Containers runtime gives an inbound Worker request
 * roughly 30s of wallclock before the platform tears the DO invocation
 * down. A cold control-plane boot against a fresh Neon DB has to:
 *
 *   1. Open a Postgres connection (1–3s cold).
 *   2. Run `CREATE TABLE IF NOT EXISTS` for every `sys_*` object —
 *      one round-trip per table because `driver-sql` does not yet
 *      implement `batchSchemaSync` (verified at
 *      packages/plugins/driver-sql/src/sql-driver.ts:108).
 *   3. Hydrate `sys_metadata`, then DDL any custom tables that just
 *      came in (Phase 3 in `ObjectQLPlugin.start`).
 *
 * Steps 1+2 alone routinely take 30–60s, so the container is killed
 * mid-DDL on every cold request and never reaches `listen(4000)`. The
 * three timeouts we previously bumped (`startupTimeout`,
 * `portReadyTimeoutMS`, `instanceGetTimeoutMS`) are necessary but
 * insufficient — the platform's request-budget is the actual wall.
 *
 * Strategy
 * ────────
 * Run schema sync ONCE from the deploy machine against the production
 * DB, then ship the container with `OS_SKIP_SCHEMA_SYNC=1` so cold
 * boots only do connection-open + sys_metadata hydration (~sub-second
 * on warm Neon).
 *
 * How it works
 * ────────────
 * This script just delegates to the existing `objectstack serve`
 * machinery (which already knows how to load `dist/objectstack.config.js`,
 * register every plugin, and bootstrap the kernel) but with two env
 * overrides:
 *
 *   • `OS_SKIP_SCHEMA_SYNC=0` — force `ObjectQLPlugin.start()` to
 *     actually run `syncRegisteredSchemas()` even if the operator's
 *     shell exports the production default.
 *   • `OS_MIGRATE_AND_EXIT=1` — `serve.ts` watches for this and
 *     `kernel.shutdown() + process.exit(0)` immediately after
 *     `runtime.start()` resolves successfully, instead of holding the
 *     port open.
 *
 * The `OS_DATABASE_URL` (and any other secrets) must be present in
 * the script's env when it runs — we do NOT push secrets here, they
 * come from `apps/cloud/.env.cloudflare.secrets` (loaded by the
 * caller, e.g. `deploy-cloudflare.sh`) or from the operator's shell.
 *
 * Usage
 * ─────
 *   pnpm --filter @objectstack/cloud build      # produces dist/objectstack.config.js
 *   pnpm --filter @objectstack/cloud migrate    # this script
 *
 * Or, automatically as part of `cf:deploy` (see deploy-cloudflare.sh).
 */

import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, readFileSync } from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP_DIR = path.resolve(__dirname, '..');
const CONFIG_PATH = path.join(APP_DIR, 'dist', 'objectstack.config.js');
const SECRETS_FILE = path.join(APP_DIR, '.env.cloudflare.secrets');

// ── 1. Verify the prebuilt config exists ─────────────────────────────
if (!existsSync(CONFIG_PATH)) {
    console.error(`✗ ${CONFIG_PATH} not found.`);
    console.error('  Run `pnpm --filter @objectstack/cloud build` first.');
    process.exit(1);
}

// ── 2. Load .env.cloudflare.secrets if present ───────────────────────
// Mirrors the parser in setup-cloudflare-secrets.sh — values may
// contain `&`, `;`, `$`, etc., so we MUST NOT use `bash source`-style
// parsing. We strip ONE optional layer of surrounding `'` or `"`.
function loadEnvFile(file: string): Record<string, string> {
    if (!existsSync(file)) return {};
    const out: Record<string, string> = {};
    const text = readFileSync(file, 'utf8');
    for (const rawLine of text.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || line.startsWith('#')) continue;
        const m = /^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
        if (!m) continue;
        const key = m[1];
        let value = m[2];
        if (
            (value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))
        ) {
            value = value.slice(1, -1);
        }
        out[key] = value;
    }
    return out;
}

const fileEnv = loadEnvFile(SECRETS_FILE);
// Don't clobber values the operator already set in their shell — the
// shell wins because that's where one-off overrides happen.
const mergedEnv: NodeJS.ProcessEnv = { ...fileEnv, ...process.env };

// ── 3. Sanity-check that we have a real DB URL ───────────────────────
const dbUrl = mergedEnv.OS_DATABASE_URL || mergedEnv.OS_CONTROL_DATABASE_URL;
if (!dbUrl) {
    console.error('✗ OS_DATABASE_URL is not set.');
    console.error(`  Set it in ${SECRETS_FILE} or export it in your shell.`);
    process.exit(1);
}
if (dbUrl.startsWith('file:') || dbUrl.includes(':memory:')) {
    console.error(`✗ OS_DATABASE_URL points at a local file (${dbUrl}).`);
    console.error('  Migrating local SQLite is pointless — the container ships');
    console.error('  with a fresh ephemeral filesystem. Point at production Neon/Turso.');
    process.exit(1);
}

// ── 4. Force schema sync ON, exit-after-bootstrap ON ─────────────────
mergedEnv.OS_SKIP_SCHEMA_SYNC = '0';
mergedEnv.OS_MIGRATE_AND_EXIT = '1';
// Run on a non-conflicting port so we don't fight a `pnpm dev` instance.
mergedEnv.PORT = mergedEnv.MIGRATE_PORT ?? '4099';
// Quiet down the runtime banner — the migration banner is what matters here.
mergedEnv.OS_DISABLE_CONSOLE = '1';

const redactedUrl = dbUrl.replace(/:\/\/[^@]+@/, '://***@');
console.log('────────────────────────────────────────────────────────────');
console.log(' ObjectStack Cloud — out-of-band schema migration');
console.log('────────────────────────────────────────────────────────────');
console.log(` Config : ${path.relative(process.cwd(), CONFIG_PATH)}`);
console.log(` Target : ${redactedUrl}`);
console.log(' Mode   : OS_MIGRATE_AND_EXIT=1, OS_SKIP_SCHEMA_SYNC=0');
console.log('────────────────────────────────────────────────────────────');

// ── 5. Delegate to `objectstack serve --prebuilt` ────────────────────
// We use the local CLI binary from the workspace so this works inside
// `pnpm --filter @objectstack/cloud migrate` without a separate npx
// resolution. `--prebuilt` skips esbuild/bundle-require — the dist file
// is already pure ESM.
const cliBin = path.join(APP_DIR, 'node_modules', '.bin', 'objectstack');
// `--no-server` skips the Hono HTTP server plugin entirely so we don't
// have to bind a port at all. Schema sync lives in
// `ObjectQLPlugin.start()`, which runs regardless. `--no-ui` skips the
// Studio static asset plugin (irrelevant for migration).
const args = ['serve', CONFIG_PATH, '--prebuilt', '--no-ui', '--no-server'];

const child = spawn(cliBin, args, {
    cwd: APP_DIR,
    env: mergedEnv,
    stdio: 'inherit',
});

child.on('exit', (code, signal) => {
    if (signal) {
        console.error(`✗ migrate killed by signal ${signal}`);
        process.exit(1);
    }
    process.exit(code ?? 0);
});
child.on('error', (err) => {
    console.error(`✗ failed to spawn objectstack CLI: ${err.message}`);
    process.exit(1);
});
