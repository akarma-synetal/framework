---
'@objectstack/account': patch
---

Move all 26 runtime `dependencies` to `devDependencies`. `@objectstack/account` is a pure-SPA package — `files: ['dist']` only ships the Vite-bundled `index.html` + `assets/*.js` + `assets/*.css`. The browser never imports `react`, `@radix-ui/*`, `@tanstack/react-router`, `@objectstack/client`, etc. directly — they are all already bundled into the dist JS.

**Impact** (measured via `npm install @objectstack/account` in a fresh project):

| | Before | After |
|---|---|---|
| node_modules packages pulled | **33** | **1** |
| on-disk size | **129 MB** | **2 MB** |
| install time | ~4 min | seconds |

Tarball itself is unchanged (still ~400KB, 7 files in `package/dist/` + `package.json` + `LICENSE`). Vite build still produces the same `dist/` (`pnpm --filter @objectstack/account build` verified — 2103 modules → 1.29 MB bundle).
