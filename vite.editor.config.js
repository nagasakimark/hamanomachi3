// Standalone build of the map editor only: one self-contained HTML file that
// opens by double-click (no server, no game files needed).
import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { resolve } from 'node:path';

export default defineConfig({
  base: './',
  plugins: [viteSingleFile()],
  build: {
    outDir: 'dist-editor',
    emptyOutDir: true,
    chunkSizeWarningLimit: 5000,
    rollupOptions: { input: resolve(__dirname, 'map-editor.html') },
  },
});
