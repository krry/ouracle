import { browser } from '$app/environment';
import { registerSW } from 'virtual:pwa-register';
import type { RegisterSWOptions } from 'vite-plugin-pwa/types';

const UPDATE_INTERVAL_MS = 5 * 60 * 1000;

export function initPwa() {
  if (!browser) return () => {};

  let updateTimer: number | undefined;
  let checkForUpdates: (() => void) | undefined;

  const options: RegisterSWOptions = {
    immediate: true,
    onRegisteredSW(_swUrl: string, swRegistration: ServiceWorkerRegistration | undefined) {
      if (!swRegistration) return;

      checkForUpdates = () => {
        if (document.visibilityState === 'hidden') return;
        swRegistration.update().catch(() => {});
      };

      checkForUpdates();

      updateTimer = window.setInterval(checkForUpdates, UPDATE_INTERVAL_MS);
      window.addEventListener('focus', checkForUpdates);
      document.addEventListener('visibilitychange', checkForUpdates);
    },
    onRegisterError(error: unknown) {
      console.error('[PWA] Service worker registration failed', error);
    }
  };

  registerSW(options);

  return () => {
    if (updateTimer) window.clearInterval(updateTimer);
    if (checkForUpdates) {
      window.removeEventListener('focus', checkForUpdates);
      document.removeEventListener('visibilitychange', checkForUpdates);
    }
  };
}
