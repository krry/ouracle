import { sveltekit } from '@sveltejs/kit/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    sveltekit(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'manifest.json'],
      manifest: {
        name: 'Ouracle',
        short_name: 'Ouracle',
        description: 'Multimodal divination web app — Tarot, I Ching, Gene Keys, Delphi',
        theme_color: '#6366f1',
        background_color: '#0a0a0a',
        display: 'standalone',
        orientation: 'any',
        scope: '/',
        start_url: '/?source=pwa',
        icons: [
          {
            src: 'pwa-64x64.png',
            sizes: '64x64',
            type: 'image/png'
          },
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      },
      workbox: {
        // Development: disable caching, always fetch network
        // Production: enable caching with cleanup
        enabled: process.env.NODE_ENV === 'production',
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/api\./i,
            handler: 'NetworkOnly',
            method: 'GET',
            options: {
              cacheName: 'ouracle-api-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 5 * 60 // 5 minutes
              },
              cacheKeyWillBeUsed: async ({ request }) => {
                // Bust cache on query params that indicate freshness
                const url = new URL(request.url);
                if (url.searchParams.get('_t') || url.searchParams.get('_nocache')) {
                  return `${request.url}&_buster=${Date.now()}`;
                }
                return request.url;
              }
            }
          },
          {
            urlPattern: /\.(?:js|css|html|json)$/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'ouracle-static-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 24 * 60 * 60 // 24 hours
              }
            }
          },
          {
            urlPattern: /\.(?:png|jpg|jpeg|gif|svg|webp|ico|woff2?)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'ouracle-assets-cache',
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 30 * 24 * 60 * 60 // 30 days
              }
            }
          }
        ],
        navigationPreload: true,
        navigateFallback: '/index.html'
      },
      // Dev mode: always update and skip waiting
      devOptions: {
        enabled: process.env.NODE_ENV === 'development',
        type: 'module'
      }
    })
  ],
  resolve: {
    alias: {
      $src: '/src'
    }
  }
});