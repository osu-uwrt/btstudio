import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

/**
 * Vite configuration for BTstudio.
 *
 * - React plugin provides Fast Refresh (HMR) during development.
 * - `base: './'` ensures assets use relative paths so the Electron
 *   production build can load them from the local filesystem.
 * - Output goes to `build/` to match the existing Electron main.js reference.
 * - Vitest is configured with jsdom for DOM-based unit tests.
 */
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'build',
    sourcemap: true,
  },
  server: {
    port: 3000,
    strictPort: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      reporter: ['text', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/test/**', 'src/**/*.d.ts'],
    },
  },
});
