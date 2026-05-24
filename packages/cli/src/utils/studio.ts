// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Studio UI Integration Utilities
 *
 * Handles resolving and serving the `@object-ui/studio` SPA. The Studio
 * source code lives upstream in the `objectstack-ai/objectui` monorepo
 * and is published to npm as `@object-ui/studio`. The framework no
 * longer ships its own copy of the SPA source — we resolve the
 * installed package and serve its pre-built `dist/` verbatim, exactly
 * the same convention used for `@object-ui/console` (see `./console.ts`).
 */
import path from 'path';
import fs from 'fs';
import { createRequire } from 'module';
import { pathToFileURL } from 'url';

// ─── Constants ──────────────────────────────────────────────────────

/** URL mount path for the Studio designer inside the ObjectStack server */
export const STUDIO_PATH = '/_studio';

/** npm package name for the upstream Studio SPA. */
const STUDIO_PACKAGE = '@object-ui/studio';

// ─── Path Resolution ────────────────────────────────────────────────

/**
 * Resolve the filesystem path to the `@object-ui/studio` package.
 *
 * Resolution order (mirrors `resolveConsolePath`):
 *   1. `require.resolve` from the consumer cwd (typical app install).
 *   2. `require.resolve` from this CLI's own location (pnpm workspace).
 *   3. Direct `<cwd>/node_modules/@object-ui/studio` filesystem check.
 *   4. Sibling-repo dev fallback — `../objectui/apps/studio` — so the
 *      framework monorepo can be developed against an in-tree checkout
 *      of objectui without publishing every change. Matched by checking
 *      `package.json.name === "@object-ui/studio"`.
 */
export function resolveStudioPath(): string | null {
  const cwd = process.cwd();

  // 1 + 2: node module resolution from cwd and from the CLI itself.
  const resolutionBases = [
    pathToFileURL(path.join(cwd, 'package.json')).href, // consumer workspace
    import.meta.url,                                      // CLI package itself
  ];

  for (const base of resolutionBases) {
    try {
      const req = createRequire(base);
      // `@object-ui/studio` ships only `dist/` files (no `main`/`exports`
      // pointing at JS), so the package can't be resolved as a bare
      // import. Resolve `package.json` directly — it's always in the
      // package root and not gated by an `exports` field unless the
      // publisher explicitly removes it (this package doesn't).
      const resolved = req.resolve(`${STUDIO_PACKAGE}/package.json`);
      return path.dirname(resolved);
    } catch {
      // Not resolvable from this base — try next.
    }
  }

  // 3: direct filesystem check in cwd/node_modules.
  const directPath = path.join(cwd, 'node_modules', '@object-ui', 'studio');
  if (fs.existsSync(path.join(directPath, 'package.json'))) {
    return directPath;
  }

  // 4: sibling-repo dev fallback. Useful when iterating on Studio
  // source inside `objectui` while running the framework CLI here.
  const siblingCandidates = [
    path.resolve(cwd, '../objectui/apps/studio'),
    path.resolve(cwd, '../../objectui/apps/studio'),
  ];
  for (const candidate of siblingCandidates) {
    const pkgPath = path.join(candidate, 'package.json');
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
        if (pkg.name === STUDIO_PACKAGE) return candidate;
      } catch {
        // Skip invalid package.json
      }
    }
  }

  return null;
}

/**
 * Check whether the Studio package has a pre-built `dist/` directory.
 */
export function hasStudioDist(studioPath: string): boolean {
  return fs.existsSync(path.join(studioPath, 'dist', 'index.html'));
}

/**
 * Create a lightweight kernel plugin that serves the pre-built Studio
 * static files at `/_studio/*`. Used in production mode.
 *
 * Uses Node.js built-in fs for static file serving to avoid external
 * bundling dependencies.
 */
export function createStudioStaticPlugin(distPath: string, options?: { isDev?: boolean; rootRedirect?: boolean }) {
  return {
    name: 'com.objectstack.studio-static',

    init: async () => {},

    start: async (ctx: any) => {
      const httpServer = ctx.getService?.('http.server');
      if (!httpServer?.getRawApp) {
        ctx.logger?.warn?.('Studio static: http.server service not found — skipping');
        return;
      }

      const app = httpServer.getRawApp();
      const absoluteDist = path.resolve(distPath);

      const indexPath = path.join(absoluteDist, 'index.html');
      if (!fs.existsSync(indexPath)) {
        ctx.logger?.warn?.(`Studio static: dist not found at ${absoluteDist}`);
        return;
      }

      // The published @object-ui/studio build uses RELATIVE asset URLs
      // (`./assets/...`) so the same bundle can be mounted at any path.
      // Inject `<base href="${STUDIO_PATH}/">` into index.html so:
      //   1. Relative asset URLs resolve against the mount point
      //      regardless of how deep the SPA-fallback route is
      //      (e.g. `/_studio/objects/foo/edit` would otherwise try to
      //      fetch `/_studio/objects/foo/assets/...`).
      //   2. The SPA's router can derive its basename from
      //      `document.baseURI` if it needs to.
      //
      // Idempotent — older Studio builds that already shipped an
      // absolute `<base>` or were built with `base: '/_studio/'` are
      // left untouched.
      //
      // IMPORTANT: read index.html fresh on every fallback hit. Caching the
      // bytes at startup means a Studio rebuild (which mints new hashed asset
      // names) yields a server that points the browser at non-existent assets,
      // and the SPA fallback then re-serves the stale HTML with text/html MIME
      // — producing the "Failed to load module script" browser error.
      const readIndexHtml = () => {
        const raw = fs.readFileSync(indexPath, 'utf-8');
        if (/<base\s/i.test(raw)) return raw;
        const baseTag = `<base href="${STUDIO_PATH}/">`;
        return raw.replace(/<head(\s[^>]*)?>/i, (m) => `${m}\n    ${baseTag}`);
      };

      // Redirect root to Studio when the orchestrator says so. This is the
      // case in dev mode (convenience), and also in production deployments
      // that disable the runtime Console (e.g. control-plane hosts like
      // `apps/cloud` set OS_DISABLE_CONSOLE=1 so Studio owns `/`).
      if (options?.rootRedirect !== false) {
        app.get('/', (c: any) => c.redirect(`${STUDIO_PATH}/`));
      }
      // Redirect bare path
      app.get(STUDIO_PATH, (c: any) => c.redirect(`${STUDIO_PATH}/`));

      // Serve static files with SPA fallback
      app.get(`${STUDIO_PATH}/*`, async (c: any) => {
        const reqPath = c.req.path.substring(STUDIO_PATH.length) || '/';
        const filePath = path.join(absoluteDist, reqPath);

        // Security: prevent path traversal
        if (!filePath.startsWith(absoluteDist)) {
          return c.text('Forbidden', 403);
        }

        // Try serving the exact file (HTML files go through the base-tag
        // injection path so all entry points stay path-portable).
        if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
          if (filePath.endsWith('.html')) {
            return new Response(readIndexHtml(), {
              headers: { 'content-type': 'text/html; charset=utf-8' },
            });
          }
          const content = fs.readFileSync(filePath);
          return new Response(content, {
            headers: { 'content-type': mimeType(filePath) },
          });
        }

        // Hashed-asset paths must never SPA-fallback. Otherwise a stale HTML
        // pointing at a removed asset name silently degrades into "asset URL
        // returns text/html" and the browser refuses to execute the module.
        // Returning a real 404 surfaces the rebuild/redeploy mismatch instead.
        if (reqPath.startsWith('/assets/')) {
          return c.text('Not Found', 404);
        }

        // SPA fallback: serve index.html for non-file, non-asset routes
        return new Response(readIndexHtml(), {
          headers: { 'content-type': 'text/html; charset=utf-8' },
        });
      });
    },
  };
}

// ─── Dev-only Write API ─────────────────────────────────────────────

/**
 * Dev-only plugin that exposes a tiny write API at
 * `/_studio/api/metadata/*` so Studio's "Create" dialogs can scaffold
 * real `.ts` files instead of asking the user to paste a snippet.
 *
 * Security posture: enabled ONLY when `isDev === true`. All file paths
 * must live under `<cwd>`, contain a `/src/` segment, and carry an
 * approved extension. Path traversal (`..`) and absolute paths are
 * rejected outright. Existing files are NEVER overwritten unless the
 * caller passes `mode: 'overwrite'`.
 *
 * Endpoints:
 *   GET  /_studio/api/metadata/layout?package=<id>
 *     200: { srcRoot: string }   relative to cwd, e.g. "src" or "packages/<id>/src"
 *
 *   POST /_studio/api/metadata/file
 *     body: { path: string, content: string, mode?: 'create' | 'overwrite' }
 *     200: { ok: true, path: string }
 *     409: { ok: false, error: 'exists' }
 *     400: { ok: false, error: ... }
 */
export function createStudioWriteApiPlugin(cwd: string, options: { isDev: boolean } = { isDev: false }) {
  return {
    name: 'com.objectstack.studio-write-api',

    init: async () => {},

    start: async (ctx: any) => {
      if (!options.isDev) return;
      const httpServer = ctx.getService?.('http.server');
      if (!httpServer?.getRawApp) {
        ctx.logger?.warn?.('Studio write API: http.server not found — skipping');
        return;
      }

      const app = httpServer.getRawApp();
      const projectRoot = path.resolve(cwd);
      const ALLOWED_EXT = new Set(['.ts', '.tsx', '.json']);

      const respond = (_c: any, status: number, body: Record<string, unknown>) =>
        new Response(JSON.stringify(body), {
          status,
          headers: { 'content-type': 'application/json; charset=utf-8' },
        });

      // Resolve the most likely source-code root for a given package id.
      const resolveSrcRoot = (pkgId: string | null): string | null => {
        const candidates = [
          pkgId ? path.join('packages', pkgId, 'src') : null,
          pkgId ? path.join('examples', pkgId, 'src') : null,
          'src',  // single-app project layout
        ].filter(Boolean) as string[];
        for (const c of candidates) {
          if (fs.existsSync(path.join(projectRoot, c))) return c;
        }
        return null;
      };

      app.get(`${STUDIO_PATH}/api/metadata/layout`, (c: any) => {
        const pkgId = c.req.query?.('package') ?? null;
        const srcRoot = resolveSrcRoot(pkgId);
        return respond(c, 200, { srcRoot });
      });

      app.post(`${STUDIO_PATH}/api/metadata/file`, async (c: any) => {
        let body: any;
        try {
          body = await c.req.json();
        } catch {
          return respond(c, 400, { ok: false, error: 'invalid json body' });
        }

        const rel = typeof body?.path === 'string' ? body.path : '';
        const content = typeof body?.content === 'string' ? body.content : '';
        const mode = body?.mode === 'overwrite' ? 'overwrite' : 'create';

        if (!rel) return respond(c, 400, { ok: false, error: 'path is required' });
        if (path.isAbsolute(rel) || rel.split(/[\\/]/).includes('..')) {
          return respond(c, 400, { ok: false, error: 'path must be a project-relative path without `..`' });
        }
        const ext = path.extname(rel).toLowerCase();
        if (!ALLOWED_EXT.has(ext)) {
          return respond(c, 400, { ok: false, error: `unsupported extension ${ext}` });
        }

        const abs = path.resolve(projectRoot, rel);
        if (!abs.startsWith(projectRoot + path.sep)) {
          return respond(c, 400, { ok: false, error: 'path escapes project root' });
        }

        // Must contain a `/src/` segment — keeps writes scoped to source
        // code, not random config files at the repo root.
        const segments = path.relative(projectRoot, abs).split(path.sep);
        if (!segments.includes('src')) {
          return respond(c, 400, { ok: false, error: 'path must live under a src/ directory' });
        }

        if (fs.existsSync(abs) && mode === 'create') {
          return respond(c, 409, { ok: false, error: 'exists' });
        }

        try {
          await fs.promises.mkdir(path.dirname(abs), { recursive: true });
          await fs.promises.writeFile(abs, content, 'utf-8');
          ctx.logger?.info?.(`Studio write API: ${mode} ${rel}`);
          return respond(c, 200, { ok: true, path: rel });
        } catch (err: any) {
          ctx.logger?.error?.(`Studio write API failed: ${err?.message}`);
          return respond(c, 500, { ok: false, error: err?.message ?? String(err) });
        }
      });

      ctx.logger?.info?.(`Studio write API mounted at ${STUDIO_PATH}/api/metadata/* (dev mode)`);

      /**
       * Shared validation for endpoints that mutate an existing `.ts`
       * source file by relative path. Returns `{ abs }` on success or
       * a respond() Response when validation fails.
       */
      const validateTsPath = (c: any, rel: string): { abs: string } | any => {
        if (!rel) return respond(c, 400, { ok: false, error: 'path is required' });
        if (path.isAbsolute(rel) || rel.split(/[\\/]/).includes('..')) {
          return respond(c, 400, { ok: false, error: 'path must be a project-relative path without `..`' });
        }
        if (path.extname(rel).toLowerCase() !== '.ts') {
          return respond(c, 400, { ok: false, error: 'only .ts files are supported' });
        }
        const abs = path.resolve(projectRoot, rel);
        if (!abs.startsWith(projectRoot + path.sep)) {
          return respond(c, 400, { ok: false, error: 'path escapes project root' });
        }
        if (!path.relative(projectRoot, abs).split(path.sep).includes('src')) {
          return respond(c, 400, { ok: false, error: 'path must live under a src/ directory' });
        }
        if (!fs.existsSync(abs)) {
          return respond(c, 404, { ok: false, error: 'file not found' });
        }
        return { abs };
      };

      app.post(`${STUDIO_PATH}/api/metadata/field-patch`, async (c: any) => {
        let body: any;
        try { body = await c.req.json(); } catch {
          return respond(c, 400, { ok: false, error: 'invalid json body' });
        }
        const rel = typeof body?.path === 'string' ? body.path : '';
        const fieldKey = typeof body?.field === 'string' ? body.field : '';
        const patch = body?.patch && typeof body.patch === 'object' ? body.patch : null;
        if (!fieldKey || !patch) {
          return respond(c, 400, { ok: false, error: 'field and patch are required' });
        }
        const v = validateTsPath(c, rel);
        if (!v.abs) return v;

        try {
          const { patchObjectFieldFile } = await import('./studio-field-patch.js');
          const result = await patchObjectFieldFile(v.abs, fieldKey, patch);
          if (!result.ok) return respond(c, 400, result);
          ctx.logger?.info?.(`Studio field-patch: ${rel} field=${fieldKey} keys=${Object.keys(patch).join(',')}`);
          return respond(c, 200, { ok: true, path: rel, field: fieldKey });
        } catch (err: any) {
          ctx.logger?.error?.(`Studio field-patch failed: ${err?.message}`);
          return respond(c, 500, { ok: false, error: err?.message ?? String(err) });
        }
      });

      app.post(`${STUDIO_PATH}/api/metadata/field-add`, async (c: any) => {
        let body: any;
        try { body = await c.req.json(); } catch {
          return respond(c, 400, { ok: false, error: 'invalid json body' });
        }
        const rel = typeof body?.path === 'string' ? body.path : '';
        const fieldName = typeof body?.fieldName === 'string' ? body.fieldName : '';
        const initializer = typeof body?.initializer === 'string' ? body.initializer : '';
        if (!fieldName || !initializer) {
          return respond(c, 400, { ok: false, error: 'fieldName and initializer are required' });
        }
        const v = validateTsPath(c, rel);
        if (!v.abs) return v;

        try {
          const { addObjectField } = await import('./studio-field-patch.js');
          const result = await addObjectField(v.abs, fieldName, initializer);
          if (!result.ok) {
            // Existing field is a 409 conflict; other errors stay 400.
            const status = result.error.includes('already exists') ? 409 : 400;
            return respond(c, status, result);
          }
          ctx.logger?.info?.(`Studio field-add: ${rel} field=${fieldName}`);
          return respond(c, 200, { ok: true, path: rel, field: fieldName });
        } catch (err: any) {
          ctx.logger?.error?.(`Studio field-add failed: ${err?.message}`);
          return respond(c, 500, { ok: false, error: err?.message ?? String(err) });
        }
      });

      app.post(`${STUDIO_PATH}/api/metadata/field-reorder`, async (c: any) => {
        let body: any;
        try { body = await c.req.json(); } catch {
          return respond(c, 400, { ok: false, error: 'invalid json body' });
        }
        const rel = typeof body?.path === 'string' ? body.path : '';
        const order = Array.isArray(body?.order) ? (body.order as unknown[]).filter((s) => typeof s === 'string') as string[] : null;
        if (!order || order.length === 0) {
          return respond(c, 400, { ok: false, error: 'order is required (non-empty string[])' });
        }
        const v = validateTsPath(c, rel);
        if (!v.abs) return v;

        try {
          const { reorderObjectFields } = await import('./studio-field-patch.js');
          const result = await reorderObjectFields(v.abs, order);
          if (!result.ok) return respond(c, 400, result);
          ctx.logger?.info?.(`Studio field-reorder: ${rel} (${order.length} fields)`);
          return respond(c, 200, { ok: true, path: rel, count: order.length });
        } catch (err: any) {
          ctx.logger?.error?.(`Studio field-reorder failed: ${err?.message}`);
          return respond(c, 500, { ok: false, error: err?.message ?? String(err) });
        }
      });
    },
  };
}

// ─── Helpers ────────────────────────────────────────────────────────

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.mjs':  'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.ico':  'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf':  'font/ttf',
  '.map':  'application/json',
};

function mimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_TYPES[ext] || 'application/octet-stream';
}
