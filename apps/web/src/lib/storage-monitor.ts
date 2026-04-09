/**
 * iOS PWA Storage Monitoring
 * 
 * Monitors IndexedDB and localStorage usage to prevent iOS PWA reloads
 * caused by storage quota exceeded errors.
 */

export interface StorageMetrics {
  localStorageUsage: number;
  localStorageQuota: number;
  indexedDBUsage?: number;
  indexedDBQuota?: number;
  timestamp: number;
}

class StorageMonitor {
  private metrics: StorageMetrics[] = [];
  private isMonitoring = false;
  private monitorInterval: number | null = null;
  private readonly MAX_METRICS = 100;
  private readonly MONITOR_INTERVAL = 30000; // 30 seconds

  startMonitoring() {
    if (this.isMonitoring) return;
    this.isMonitoring = true;
    
    // Initial measurement
    this.collectMetrics();
    
    // Periodic monitoring
    this.monitorInterval = window.setInterval(() => {
      this.collectMetrics();
      this.checkThresholds();
    }, this.MONITOR_INTERVAL);
  }

  stopMonitoring() {
    this.isMonitoring = false;
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }
  }

  private async collectMetrics(): Promise<void> {
    const now = Date.now();
    
    // Measure localStorage
    const localStorageUsage = this.getLocalStorageUsage();
    const localStorageQuota = this.getLocalStorageQuota();
    
    // Measure IndexedDB if available
    let indexedDBUsage: number | undefined;
    let indexedDBQuota: number | undefined;
    
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      try {
        const estimate = await navigator.storage.estimate();
        indexedDBUsage = estimate.usage;
        indexedDBQuota = estimate.quota;
      } catch (e) {
        console.warn('[Storage] Failed to estimate IndexedDB usage:', e);
      }
    }

    const metrics: StorageMetrics = {
      localStorageUsage,
      localStorageQuota,
      indexedDBUsage,
      indexedDBQuota,
      timestamp: now
    };

    this.metrics.push(metrics);
    
    // Keep only recent metrics to prevent memory growth
    if (this.metrics.length > this.MAX_METRICS) {
      this.metrics.shift();
    }

    // Dispatch custom event for components to listen to
    window.dispatchEvent(new CustomEvent('storage-metrics', { detail: metrics }));
  }

  private getLocalStorageUsage(): number {
    try {
      let total = 0;
      for (const key in localStorage) {
        if (localStorage.hasOwnProperty(key)) {
          total += localStorage[key].length;
        }
      }
      return total;
    } catch {
      return 0;
    }
  }

  private getLocalStorageQuota(): number {
    // iOS localStorage quota is typically around 5-10MB, but varies
    // We'll use a conservative estimate of 5MB
    return 5 * 1024 * 1024;
  }

  private checkThresholds(): void {
    const latest = this.metrics[this.metrics.length - 1];
    if (!latest) return;

    const localStoragePercent = (latest.localStorageUsage / latest.localStorageQuota) * 100;
    
    if (latest.indexedDBQuota && latest.indexedDBUsage) {
      const indexedDBPercent = (latest.indexedDBUsage / latest.indexedDBQuota) * 100;
      
      // Warn if approaching limits
      if (indexedDBPercent > 80) {
        console.warn(`[Storage] IndexedDB usage at ${indexedDBPercent.toFixed(1)}% of quota`);
        this.handleStorageWarning('indexeddb', indexedDBPercent);
      }
    }

    if (localStoragePercent > 80) {
      console.warn(`[Storage] localStorage usage at ${localStoragePercent.toFixed(1)}% of quota`);
      this.handleStorageWarning('localStorage', localStoragePercent);
    }
  }

  private handleStorageWarning(storageType: 'localStorage' | 'indexeddb', percent: number): void {
    // Dispatch warning event
    window.dispatchEvent(new CustomEvent('storage-warning', {
      detail: { storageType, percent, metrics: this.getLatestMetrics() }
    }));

    // If localStorage is getting full, warn user and suggest cleanup
    if (storageType === 'localStorage' && percent > 90) {
      this.suggestCleanup();
    }
  }

  private suggestCleanup(): void {
    // For iOS, localStorage can fill up quickly with conversation history
    const shouldWarn = localStorage.getItem('storage-warning-shown') !== 'true';
    
    if (shouldWarn) {
      localStorage.setItem('storage-warning-shown', 'true');
      
      // Show a subtle warning to the user
      const warning = document.createElement('div');
      warning.className = 'storage-warning';
      warning.innerHTML = `
        <div class="storage-warning-content">
          <span>Storage space low. Consider clearing conversation history.</span>
          <button class="storage-warning-action">Clear History</button>
        </div>
      `;
      
      // Add styles
      const style = document.createElement('style');
      style.textContent = `
        .storage-warning {
          position: fixed;
          bottom: env(safe-area-inset-bottom, 0px) + 1rem;
          left: 50%;
          transform: translateX(-50%);
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          padding: 0.75rem 1rem;
          color: var(--muted);
          font-size: 0.8rem;
          font-family: var(--font-mono);
          z-index: 1000;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          animation: slideUp 0.3s ease-out;
        }
        .storage-warning-content {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }
        .storage-warning-action {
          background: transparent;
          border: 1px solid var(--border);
          color: var(--accent);
          padding: 0.25rem 0.5rem;
          border-radius: 4px;
          font-size: 0.75rem;
          cursor: pointer;
          transition: all 0.2s;
        }
        .storage-warning-action:hover {
          background: var(--accent);
          color: white;
          border-color: var(--accent);
        }
        @keyframes slideUp {
          from { transform: translateX(-50%) translateY(20px); opacity: 0; }
          to { transform: translateX(-50%) translateY(0); opacity: 1; }
        }
      `;
      document.head.appendChild(style);

      // Add to DOM
      document.body.appendChild(warning);

      // Handle clear button
      const clearBtn = warning.querySelector('.storage-warning-action');
      if (clearBtn) {
        clearBtn.addEventListener('click', () => {
          this.clearLocalStorageData();
          warning.remove();
          style.remove();
        });
      }

      // Auto-hide after 10 seconds
      setTimeout(() => {
        warning.remove();
        style.remove();
      }, 10000);
    }
  }

  private clearLocalStorageData(): void {
    try {
      // Clear conversation data but preserve essential settings
      const preserveKeys = [
        'clea_creds',
        'clea_session_id',
        'clea_pending_rite',
        'clea_guest_token',
        'clea_covenant_prompt_armed',
        'clea_seeker_state',
        'clea_tts',
        'clea_tts_voice',
        'clea_ptt_seen',
        'storage-warning-shown'
      ];

      const toRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && !preserveKeys.includes(key)) {
          toRemove.push(key);
        }
      }

      toRemove.forEach(key => localStorage.removeItem(key));
      
      console.log(`[Storage] Cleared ${toRemove.length} localStorage entries`);
      
      // Dispatch cleanup event
      window.dispatchEvent(new CustomEvent('storage-cleared', {
        detail: { removedCount: toRemove.length }
      }));

    } catch (e) {
      console.error('[Storage] Failed to clear localStorage:', e);
    }
  }

  getLatestMetrics(): StorageMetrics | null {
    return this.metrics.length > 0 ? this.metrics[this.metrics.length - 1] : null;
  }

  getMetricsHistory(): StorageMetrics[] {
    return [...this.metrics];
  }

  // Utility method to check if we're on iOS
  static isIOS(): boolean {
    return /iPad|iPhone|iPod/.test(navigator.userAgent);
  }

  // Utility method to check if we're in a PWA
  static isPWA(): boolean {
    return window.matchMedia && window.matchMedia('(display-mode: standalone)').matches;
  }
}

// Create singleton instance
export const storageMonitor = new StorageMonitor();

// Auto-start monitoring on iOS PWA
if (StorageMonitor.isIOS() && StorageMonitor.isPWA()) {
  storageMonitor.startMonitoring();
  
  // Stop monitoring when page is hidden to save battery
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      storageMonitor.stopMonitoring();
    } else {
      storageMonitor.startMonitoring();
    }
  });
}
