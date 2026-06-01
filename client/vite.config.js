import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['pwa-icon.svg'],
      manifest: {
        name: 'Company Drive',
        short_name: 'Drive',
        description: 'Корпоративное файловое хранилище',
        theme_color: '#0071e3',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/pwa-icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: '/pwa-icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        // NEVER let the SW hijack API requests — downloads/previews/streaming
        // go straight to the network (a download link is a navigation request,
        // which navigateFallback would otherwise replace with index.html).
        navigateFallbackDenylist: [/^\/api\//],
        globPatterns: ['**/*.{js,css,html,svg,woff,woff2}'],
        // Cache JSON list endpoints (NetworkFirst) so the last-viewed folder/
        // favorites/recent lists are available offline. Never cache big media.
        runtimeCaching: [
          {
            urlPattern: ({ url, request }) =>
              request.method === 'GET' &&
              /\/api\/(folders|files|favorites|recent|tags|search)/.test(url.pathname) &&
              !/(download|preview|thumbnail|zip)/.test(url.pathname),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'cd-api',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 80, maxAgeSeconds: 86400 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.VITE_DEV_API_TARGET || 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 1200,
  },
});
