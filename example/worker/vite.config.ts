import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  root: __dirname,
  build: {
    minify: process.env.VITE_MINIFY === 'true',
    lib: {
      entry: 'worker.ts',
      formats: ['iife'],
      name: 'PluginFooWorker',
      fileName: () => 'web-worker.js', // used in rollupOptions.entryFileNames
    },
    outDir: path.resolve(__dirname, '../public'),
    emptyOutDir: false,
    rollupOptions: {
      // Exclude DOM-only libraries that can't run in workers
      // html2canvas is provided by @rimori/react-client for browser contexts
      external: ['html2canvas'],
      output: {
        inlineDynamicImports: true,
        entryFileNames: 'web-worker.js',
      },
    },
  },
});
