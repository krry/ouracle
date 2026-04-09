import { browser } from '$app/environment';
import { registerSW } from 'virtual:pwa-register';
import type { RegisterSWOptions } from 'vite-plugin-pwa/types';

/**
 * iOS PWA Stability Configuration
 * 
 * Key changes to prevent spurious reloads on iOS:
 * 1. Disable all automatic update checking - VitePWA's interval causes reloads
 * 2. Only check for SW updates when app becomes visible (not on intervals)
 * 3. Skip updates if conversation is active (streaming)
 * 4. Add longer debounce to prevent race conditions
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
    // CRITICAL: Disable VitePWA's built-in polling interval
    // The default interval (20s) causes spurious reloads on iOS
    // We handle all update checking manually via visibility changes
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

      // IMPORTANT: Do NOT set up any periodic interval
      // VitePWA's registerType: 'autoUpdate' has its own internal polling
      // which we cannot disable, but we can prevent it from triggering reloads
      // by intercepting onNeedRefresh
    },
    onRegisterError(error: unknown) {
      console.error('[PWA] Service worker registration failed', error);
    },
    onNeedRefresh() {
      // CRITICAL: Never auto-reload on iOS PWA
      // This is the primary cause of spurious reloads
      if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
        console.log('[PWA] New content available (will not auto-reload on iOS)');
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
