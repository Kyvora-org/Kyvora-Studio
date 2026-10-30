import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { mediaStreamPlugin } from '../../scripts/mediaStreamPlugin';

export default defineConfig({
  plugins: [react(), mediaStreamPlugin()],
  resolve: {
    alias: {
      '@kyvora/editor-core': path.resolve(__dirname, '../../packages/editor-core/src'),
      '@kyvora/ui': path.resolve(__dirname, '../../packages/ui/src'),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
});
