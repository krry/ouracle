import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    sveltekit(),
    VitePWA({
      // iOS PWA Stability: Disable autoUpdate polling to prevent spurious reloads
      // Use manual update checking instead via our custom pwa.ts implementation
      registerType: 'prompt',
      includeAssets: ['favicon.ico', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png'],
      manifest: {
        name: 'Ouracle',
        short_name: 'Ouracle',
        description: 'A reflective AI companion',
        theme_color: '#0a0a0a',
        background_color: '#0a0a0a',
        display: 'standalone',
        display_override: ['standalone', 'fullscreen', 'minimal-ui'],
        orientation: 'portrait-primary',
        scope: '/',
        start_url: '/?source=pwa',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ],
        shortcuts: [
          { name: 'Draw', url: '/draw', description: 'Begin a new draw' },
          { name: 'About', url: '/about', description: 'Learn the shape of the temple' }
        ]
      },
      workbox: {
        // Raise precache chunk limit — kokoro-js and Three.js exceed the 2 MiB default.
        // Set high enough that adding new large deps won't break the build silently.
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        cleanupOutdatedCaches: true,
        navigateFallback: '/index.html',
        // Prevent the navigate fallback from swallowing auth callback routes.
        navigateFallbackDenylist: [/^\/api\//],
        // navigationPreload removed — it races the SW cache lookup and can cause
        // the wrong response to be served on iOS PWA, triggering spurious reloads.
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/api\.ouracle\.kerry\.ink\/.*$/i,
            handler: 'NetworkOnly',
            method: 'GET',
            options: {
              cacheName: 'ouracle-api',
              ...(process.env.NODE_ENV === 'production' && {
                expiration: {
                  maxEntries: 100,
                  maxAgeSeconds: 5 * 60 // 5 minutes
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
        enabled: false,
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
