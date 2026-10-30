import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { mediaStreamPlugin } from '../../scripts/mediaStreamPlugin';

// @ts-expect-error process is defined in node
const host = process.env.TAURI_DEV_HOST;

export default defineConfig({
  plugins: [react(), mediaStreamPlugin()],
  resolve: {
    alias: {
      '@kyvora/editor-core': path.resolve(__dirname, '../../packages/editor-core/src'),
      '@kyvora/ui': path.resolve(__dirname, '../../packages/ui/src'),
    },
  },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: 'ws',
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      ignored: ['**/src-tauri/**'],
    },
  },
});
