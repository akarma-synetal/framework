import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { TanStackRouterVite } from '@tanstack/router-plugin/vite';
import path from 'path';

// HMR config for embedded mode (running inside CLI via --ui)
const hmrConfig = process.env.VITE_HMR_PORT
  ? { port: parseInt(process.env.VITE_HMR_PORT), clientPort: parseInt(process.env.VITE_HMR_PORT) }
  : undefined;

// https://vitejs.dev/config/
export default defineConfig({
  base: process.env.VITE_BASE || '/_studio/',  // Studio is always mounted under /_studio/ (CLI, Vercel, self-host)
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: {
      'react': path.resolve(__dirname, './node_modules/react'),
      'react-dom': path.resolve(__dirname, './node_modules/react-dom'),
      '@': path.resolve(__dirname, './src'),
      'node:fs/promises': path.resolve(__dirname, './mocks/node-polyfills.ts'),
      'node:fs': path.resolve(__dirname, './mocks/node-polyfills.ts'),
      'node:events': path.resolve(__dirname, './mocks/node-polyfills.ts'),
      'node:stream': path.resolve(__dirname, './mocks/node-polyfills.ts'),
      'node:string_decoder': path.resolve(__dirname, './mocks/node-polyfills.ts'),
      'node:path': path.resolve(__dirname, './mocks/node-polyfills.ts'),
      'node:url': path.resolve(__dirname, './mocks/node-polyfills.ts'),
      'node:util': path.resolve(__dirname, './mocks/node-polyfills.ts'),
      'node:os': path.resolve(__dirname, './mocks/node-polyfills.ts'),
      'node:crypto': path.resolve(__dirname, './mocks/node-polyfills.ts'),
      'events': path.resolve(__dirname, './mocks/node-polyfills.ts'),
      'stream': path.resolve(__dirname, './mocks/node-polyfills.ts'),
      'string_decoder': path.resolve(__dirname, './mocks/node-polyfills.ts'),
      'path': path.resolve(__dirname, './mocks/node-polyfills.ts'),
      'fs/promises': path.resolve(__dirname, './mocks/node-polyfills.ts'),
      'fs': path.resolve(__dirname, './mocks/node-polyfills.ts'),
      'util': path.resolve(__dirname, './mocks/node-polyfills.ts'),
      'os': path.resolve(__dirname, './mocks/node-polyfills.ts'),
      'crypto': path.resolve(__dirname, './mocks/node-polyfills.ts'),
      'url': path.resolve(__dirname, './mocks/node-polyfills.ts'),
      // Fix for chokidar in browser
      'chokidar': path.resolve(__dirname, './src/mocks/noop.ts'),
    }
  },
  define: {
    'process.env': {},
    // 'process.cwd': '() => "/"', 
    // 'process.platform': '"browser"'
  },
  plugins: [
    TanStackRouterVite(),
    react(),
  ],
  server: {
    // Default to 5173 (Vite default) to avoid conflict with ObjectStack API server on 3000.
    // Use VITE_PORT env var to override (e.g. when embedded in CLI via --ui).
    port: parseInt(process.env.VITE_PORT || '5173'),
    hmr: hmrConfig,
    // Proxy API requests to the ObjectStack server when running standalone
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/.well-known': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  optimizeDeps: {
    include: [
      '@objectstack/spec',
      '@objectstack/spec/data', // Force pre-bundling for CJS compatibility
      '@objectstack/spec/system',
      '@objectstack/spec/ui',
      '@objectstack/spec/studio',
      '@objectstack/client-react'
    ]
  },
  build: {
    chunkSizeWarningLimit: 1000,
    commonjsOptions: {
      include: [/node_modules/, /packages/],
      exclude: [/\.node$/, /rollup/, /fsevents/],
      transformMixedEsModules: true
    },
    rollupOptions: {
      // Split heavy vendor groups into their own chunks so the main
      // bundle stays under the 500KB warning and the browser can cache
      // them independently across deploys.
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          // Heaviest groups first — order matters because the first
          // match wins.
          if (/[\\/]@object-ui[\\/]plugin-form[\\/]/.test(id)) return 'vendor-object-ui-form';
          if (/[\\/]@object-ui[\\/]plugin-grid[\\/]/.test(id)) return 'vendor-object-ui-grid';
          if (/[\\/]@object-ui[\\/]plugin-(dashboard|report|kanban|calendar|timeline)[\\/]/.test(id)) return 'vendor-object-ui-views';
          if (/[\\/]@object-ui[\\/]/.test(id)) return 'vendor-object-ui-core';
          if (/[\\/]@tanstack[\\/]/.test(id)) return 'vendor-tanstack';
          if (/[\\/]recharts[\\/]|[\\/]d3-/.test(id)) return 'vendor-charts';
          if (/[\\/]monaco-editor[\\/]|[\\/]codemirror[\\/]/.test(id)) return 'vendor-editor';
          if (/[\\/](react|react-dom|scheduler)[\\/]/.test(id)) return 'vendor-react';
          if (/[\\/]lucide-react[\\/]/.test(id)) return 'vendor-icons';
          if (/[\\/]@radix-ui[\\/]/.test(id)) return 'vendor-radix';
          if (/[\\/]@objectstack[\\/]/.test(id)) return 'vendor-objectstack';
          return 'vendor';
        },
      },
      // Suppress warnings for optional dynamic imports in runtime
      onwarn(warning, warn) {
        // Ignore unresolved import warnings for @objectstack/driver-memory
        // This is an optional fallback dynamic import in the runtime kernel.
        // It's safe to suppress because the driver is explicitly imported in src/mocks/browser.ts
        if (
          warning.code === 'UNRESOLVED_IMPORT' &&
          warning.message.includes('@objectstack/driver-memory')
        ) {
          return;
        }
        warn(warning);
      }
    }
  }
});
