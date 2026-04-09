# Ouracle PWA Implementation

## Overview
This document describes the PWA configuration for Ouracle web app (apps/web).

## iOS PWA Stability (Critical Fixes)
The PWA has been specifically optimized to prevent spurious reloads on iOS, which were caused by:
1. Aggressive service worker update checks racing with page restoration
2. Memory pressure from long-running SSE connections
3. Storage quota exceeded errors

### Fixes Applied:
- **Service Worker Update Debouncing**: SW updates only check when app becomes visible, with 30-minute debounce
- **Streaming State Coordination**: Global `__ouracleStreaming` flag prevents SW updates during active LLM conversations
- **iOS-Safe Refresh Handling**: `onNeedRefresh` callback prevents auto-reload on iOS
- **Storage Monitoring**: Automatic monitoring of localStorage/IndexedDB usage with cleanup suggestions
- **Conversation Recovery**: Enhanced visibility change handlers to restore state after iOS tab termination
- **Keyboard Layout**: Input bar uses `position: sticky; bottom: 0` with `visualViewport` sync to stay anchored during keyboard transitions
- **Form Navigation Suppression**: Chat input uses `autocomplete="off"`, `autocorrect="off"`, `data-form-type="other"` to minimize iOS form navigation bar

## Features
- **Safe Area Support**: Full `viewport-fit=cover` and CSS `env(safe-area-inset-*)` for notch/Dynamic Island
- **Cache Busting**: Automatic via Vite asset revision hashes; service worker disabled in dev
- **Offline Fallback**: Custom offline.html displayed when network unavailable
- **App-like Experience**: Standalone display, theme color, Apple/Android meta tags
- **iOS Stability**: Prevents spurious reloads during conversations

## Files Modified/Created

### 1. `vite.config.ts`
Enhanced VitePWA plugin with:
- Rich manifest (icons, shortcuts, start_url with `?source=pwa`)
- Workbox runtime caching strategies:
  - API: `NetworkOnly` (prod: 5m TTL optional)
  - JS/CSS: `StaleWhileRevalidate` (24h)
  - Images: `CacheFirst` (30d)
  - Fonts: `StaleWhileRevalidate` (1y)
- Dev mode: SW disabled entirely
- Cleanup outdated caches on activate

### 2. `src/routes/+layout.svelte`
- Initializes the PWA registration from `src/lib/pwa.ts`
- Layout already had safe area CSS; TopBar updated for safe-top

### 3. `src/lib/pwa.ts`
- Registers the VitePWA-generated service worker in production only
- Triggers `registration.update()` on load, focus, visibility changes, and a 5-minute interval
- Lets VitePWA auto-activate updates and reload the app when a new deployment is available

### 4. `src/app.css`
- Added CSS custom properties for safe area insets
- Applied padding to body, fixed elements, and overlays
- Prevent overscroll rubber-banding on iOS

### 5. `static/offline.html`
Offline fallback page shown when API unavailable

### 6. `static/icon.svg`
Source SVG for PWA icons (generate PNGs via script)

### 7. `scripts/build-pwa.js`
Build helper:
- Generates all icon sizes from icon.svg using sharp
- Optionally bumps cache version (`--bump`)
- Creates `.nojekyll` for GitHub Pages

### 8. `package.json`
Added script: `build:pwa` → runs icon generation then Vite build
Added `sharp` as dev dependency

## Development Workflow

### Dev Mode
```bash
cd apps/web
npm run dev
```
- Service Worker is not registered
- Cache-busting through query params works automatically
- Safe area tested via device emulation in Chrome DevTools

### Production Build
```bash
cd apps/web
npm run build:pwa   # Generates icons then builds with SW enabled
```
- Icons generated to `static/icons/` and root `static/`
- Vite emits `sw.js` and `manifest.webmanifest`
- Assets include content hash for cache busting

## Deployment Notes
- Build output: `apps/web/.svelte-kit/output` (adapter-static) or Vercel (adapter-vercel)
- Ensure `static/` contents are copied to server root
- For Vercel: `vercel.json` already configured; static assets served automatically
- For custom server: serve `static/` as static files, set SPA fallback for client-side routing

## Cache Strategy Summary
| Resource | Strategy | TTL |
|----------|----------|-----|
| API calls | NetworkOnly (no cache) | immediate |
| HTML (SPA navigation) | NetworkFirst with `/index.html` fallback | - |
| JS/CSS | StaleWhileRevalidate | 24h |
| Images | CacheFirst | 30d |
| Fonts | StaleWhileRevalidate | 1y |

## Testing PWA
1. Build production bundle: `npm run build`
2. Serve locally: `npm run preview` (or `npx serve .svelte-kit/vercel/output/static`)
3. Open Chrome DevTools → Application
   - Verify manifest parsed
   - Check Service Worker status (should be "activated")
   - Test "Update" reload cycle
4. Use device toolbar (mobile view) to test safe area insets
5. Add to Home Screen (iOS Safari: Share → Add to Home Screen; Chrome: Install icon)

## Cache Invalidation During Rapid Development
- Dev: no SW → instant updates
- Prod: Vite hashes ensure new filenames bust cache automatically
- Manual prod bust: touch `vite.config.ts` to trigger new build hashes
- API data: never cached persistently, always fresh

## Manual Cache Clear (if needed)
```js
// In browser console
caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))));
location.reload();
```
