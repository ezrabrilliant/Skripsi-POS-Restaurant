import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'POS Ayam Bakar Banjar Monosuko',
        short_name: 'POS ABM',
        description: 'Sistem Point of Sale Restoran Ayam Bakar Banjar Monosuko',
        lang: 'id',
        theme_color: '#237350',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // PWA Level A: precache app shell + foto menu (.webp) di build time.
        // Data API tetap ke jaringan - hanya aset statis yang offline-ready.
        globPatterns: ['**/*.{js,css,html,svg,png,jpg,jpeg,webp,ico,woff,woff2}'],
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/api/],
        // Fallback runtime: foto /menu/* yang ditambahkan owner setelah
        // install (mis. via halaman Menu) akan ke-cache otomatis pada
        // request pertama -> kunjungan berikutnya tampil dari device cache
        // tanpa hit jaringan. Stale-while-revalidate: tampilkan cache,
        // perbarui di background.
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/menu/'),
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'menu-images',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    allowedHosts: [
      'machelle-collectional-acropetally.ngrok-free.dev'
    ],
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          state: ['zustand', '@tanstack/react-query'],
        },
      },
    },
  },
})
