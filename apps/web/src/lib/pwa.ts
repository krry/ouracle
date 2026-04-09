import { browser } from '$app/environment';
import { registerSW } from 'virtual:pwa-register';
import type { RegisterSWOptions } from 'vite-plugin-pwa/types';

/**
 * iOS PWA Stability Configuration
 * 
 * Key changes to prevent spurious reloads on iOS:
 * 1. Only check for SW updates when app becomes visible (not on intervals)
 * 2. Skip updates if conversation is active (streaming)
 * 3. Add longer debounce to prevent race conditions
 */
const UPDATE_DEBOUNCE_MS = 30 * 60 * 1000; // 30 minutes - much longer to avoid races

export function initPwa() {
  if (!browser) return () => {};

  let updateTimer: number | undefined;
  let lastUpdateCheck = 0;
  let checkForUpdates: (() => void) | undefined;
  let swRegistration: ServiceWorkerRegistration | undefined;

  const shouldCheckForUpdate = (): boolean => {
    const now = Date.now();
    // Only check if enough time has passed since last check
    if (now - lastUpdateCheck < UPDATE_DEBOUNCE_MS) return false;
    lastUpdateCheck = now;
    return true;
  };

  const options: RegisterSWOptions = {
    immediate: true,
    onRegisteredSW(_swUrl: string, registration: ServiceWorkerRegistration | undefined) {
      if (!registration) return;
      swRegistration = registration;

      checkForUpdates = () => {
        // Skip if app is in background or hidden
        if (document.visibilityState === 'hidden') return;
        
        // Skip if we've checked recently (debounce)
        if (!shouldCheckForUpdate()) return;
        
        // On iOS, avoid checking during active streaming to prevent interruptions
        // This is a heuristic - we check a global flag that Chat.svelte manages
        if ((window as any).__ouracleStreaming) return;
        
        registration.update().catch(() => {});
      };

      // Initial check with delay to avoid race with page load
      if (checkForUpdates) {
        setTimeout(checkForUpdates, 5000);
      }

      // Only check when app becomes visible again (user returns to app)
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && checkForUpdates) {
          // Debounce the visibility change check
          setTimeout(checkForUpdates, 2000);
        }
      });

      // Remove periodic interval checks - these cause issues on iOS
      // The visibility change handler is sufficient
    },
    onRegisterError(error: unknown) {
      console.error('[PWA] Service worker registration failed', error);
    },
    onNeedRefresh() {
      // Don't auto-reload on iOS - this causes the reload issue
      // Instead, we'll show a subtle indicator if needed
      if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
        console.log('[PWA] New content available (will activate on next visit)');
        return;
      }
      // On non-iOS, we can safely reload
      window.location.reload();
    }
  };

  registerSW(options);

  return () => {
    if (updateTimer) window.clearInterval(updateTimer);
    if (checkForUpdates) {
      document.removeEventListener('visibilitychange', checkForUpdates);
    }
  };
}
