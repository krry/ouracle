/**
 * Service Worker Registration
 * Handles PWA install and update lifecycle
 */

export function registerSW() {
  if (!('serviceWorker' in navigator)) {
    console.log('[PWA] Service Worker not supported');
    return { status: 'unsupported' };
  }

  const swPath = '/service-worker.js';
  const isDev = location.search.includes('_nocache') || import.meta.env.DEV;

  if (isDev) {
    console.log('[PWA] Dev mode: skipping SW registration');
    // In dev, we skip SW to avoid caching issues
    return { status: 'dev-skip' };
  }

  navigator.serviceWorker.register(swPath, { scope: '/' })
    .then((registration) => {
      console.log('[PWA] Service Worker registered:', registration.scope);

      // Check for updates immediately
      registration.addEventListener('updatefound', () => {
        const installingWorker = registration.installing;
        installingWorker.addEventListener('statechange', () => {
          if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
            console.log('[PWA] New content available, waiting for activation');
            // You could prompt user here
            window.dispatchEvent(new CustomEvent('sw-update-available', {
              detail: { registration }
            }));
          }
        });
      });

      // Periodic update checks (every 30 minutes)
      setInterval(() => {
        registration.update();
      }, 30 * 60 * 1000);

      return { status: 'registered', registration };
    })
    .catch((error) => {
      console.error('[PWA] Registration failed:', error);
      return { status: 'error', error };
    });
}

// Call this on app startup
export function initPWA() {
  const { status } = registerSW();

  // Listen for SW update available event
  window.addEventListener('sw-update-available', (event) => {
    console.log('[PWA] Update ready — reload to activate');
    // Optional: show a toast/notification to user
    if (confirm('New version available. Reload now?')) {
      window.location.reload();
    }
  });

  return status;
}