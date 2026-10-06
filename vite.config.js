import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// base './' makes the build work from any GitHub Pages sub-path.
export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        editor: resolve(__dirname, 'map-editor.html'),
      },
    },
  },
});
