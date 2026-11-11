import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // Prompt al usuario para refrescar (en vez de auto-update silencioso).
      registerType: 'prompt',
      injectRegister: false,

      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            // Fuentes (si usamos Google Fonts en el futuro)
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'google-fonts',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
          {
            // API GETs: sobreviven offline con la última respuesta cacheada
            urlPattern: ({ url, request }) =>
              request.method === 'GET' && /\/api\/v1\//.test(url.pathname),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'cardi-api',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 80, maxAgeSeconds: 60 * 60 * 24 * 7 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },

      includeAssets: [
        'favicon.ico',
        'favicon-16x16.png',
        'favicon-32x32.png',
        'apple-touch-icon.png',
        'logo.png',
      ],

      manifest: {
        name: 'Cardi',
        short_name: 'Cardi',
        description: 'Gestión de gastos por obra — Cardi',
        theme_color: '#4390B6',
        background_color: '#FAFBFC',
        display: 'standalone',
        orientation: 'any',
        scope: '/',
        start_url: '/',
        lang: 'es-AR',
        categories: ['business', 'productivity', 'finance'],
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'pwa-maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },

      devOptions: {
        // En dev local, el SW está desactivado por default.
        // Si querés probarlo: cambiar a true.
        enabled: false,
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@cardi/shared': path.resolve(__dirname, '../packages/shared/src/index.ts'),
    },
  },
  server: {
    port: 5173,
    host: true,
  },
  preview: {
    port: Number(process.env.PORT) || 4173,
    host: true,
    // Railway sirve detrás de un proxy en *.up.railway.app — hay que permitir
    // esos hosts o vite-preview responde 403 "Blocked request".
    allowedHosts: ['.up.railway.app', '.railway.app'],
  },
});
