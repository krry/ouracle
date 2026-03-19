import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    sveltekit(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png'],
      manifest: {
        name: 'Ouracle',
        short_name: 'Ouracle',
        description: 'Speak to Ouracle.',
        theme_color: '#6366f1',
        background_color: '#0a0a0a',
        display: 'standalone',
        display_override: ['standalone', 'fullscreen', 'minimal-ui'],
        orientation: 'any',
        scope: '/',
        start_url: '/?source=pwa',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ],
        shortcuts: [
          { name: 'New Reading', url: '/enquire', description: 'Start a new divination reading' },
          { name: 'Clea', url: '/clea', description: 'Speak with Clea' }
        ]
      },
      workbox: {
        enabled: process.env.NODE_ENV === 'production',
        cleanupOutdatedCaches: true,
        navigateFallback: '/index.html',
        navigatePreload: true,
        // Ensure new SW activates immediately without waiting for clients to close
        skipWaiting: true,
        clientsClaim: true,
        // Cache-busting: use revisioned static assets from Vite manifest
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/api\.ouracle\.kerry\.ink\/.*$/i,
            handler: 'NetworkOnly',
            method: 'GET',
            options: {
              cacheName: 'ouracle-api',
              networkTimeoutSeconds: 10,
              // No caching for API in rapid dev, but we could add short TTL in prod
              ...(process.env.NODE_ENV === 'production' && {
                expiration: {
                  maxEntries: 100,
                  maxAgeSeconds: 5 * 60 // 5 minutes
                },
                cacheKeyWillBeUsed: async ({ request }) => {
                  // Add timestamp-based busting for dev-like query params
                  const url = new URL(request.url);
                  if (url.searchParams.get('_nocache') || url.searchParams.get('_t')) {
                    return `${request.url}&_buster=${Date.now()}`;
                  }
                  return request.url;
                }
              })
            }
          },
          {
            urlPattern: /\.(?:js|css)$/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'ouracle-static',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 24 * 60 * 60 // 24h
              }
            }
          },
          {
            urlPattern: /\.(?:png|jpg|jpeg|gif|svg|webp|ico)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'ouracle-images',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 30 * 24 * 60 * 60 // 30 days
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /\.(?:woff2?|ttf|eot)$/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'ouracle-fonts',
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 365 * 24 * 60 * 60 // 1 year
              }
            }
          }
        ]
      },
      // Dev mode: disable caching entirely
      devOptions: {
        enabled: process.env.NODE_ENV === 'development',
        type: 'module'
      }
    })
  ],
  server: {
    port: 2532,
    allowedHosts: ["souvenir.local"],
    https: {
      key: './certs/souvenir.local+2-key.pem',
      cert: './certs/souvenir.local+2.pem',
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
  }
});
