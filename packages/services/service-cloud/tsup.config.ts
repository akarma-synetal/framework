import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: false,
  sourcemap: true,
  clean: true,
  target: 'node18',
  outDir: 'dist',
  external: [
    '@objectstack/driver-turso',
    '@objectstack/driver-sql',
    '@objectstack/driver-memory',
    '@objectstack/objectql',
    '@objectstack/metadata',
    '@objectstack/plugin-auth',
    '@objectstack/plugin-security',
    '@objectstack/plugin-audit',
    '@objectstack/service-tenant',
    '@objectstack/service-package',
    // Native / CJS-heavy DB drivers that can't survive being bundled
    // into ESM (they use `require('events')` etc. internally and rely
    // on Node's actual module graph, not esbuild's). Resolved at runtime
    // from the host app's node_modules — declared as optional deps so
    // pnpm makes them available to this package.
    'pg',
    'pg-native',
    'pg-cloudflare',
  ],
});
