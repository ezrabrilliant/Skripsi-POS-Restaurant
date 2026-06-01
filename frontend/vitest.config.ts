import { defineConfig } from 'vitest/config'
import path from 'path'

// Konfigurasi test terpisah dari vite.config.ts supaya plugin PWA tidak ikut
// dimuat saat unit test. Unit test di sini murni (fungsi pure, tanpa DOM) →
// environment 'node'. Resolusi alias '@' tetap disediakan untuk import type.
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
})
