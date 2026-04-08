<script lang="ts">
  let { drawerOpen, ontoggle }: { drawerOpen: boolean; ontoggle: () => void } = $props();
</script>

<header class="topbar">
  <button
    class="menu-btn"
    onclick={ontoggle}
    aria-label={drawerOpen ? 'Close menu' : 'Open menu'}
    aria-expanded={drawerOpen}
  >
    <span class:open={drawerOpen}></span>
    <span class:open={drawerOpen}></span>
    <span class:open={drawerOpen}></span>
  </button>

  <a href="/" class="wordmark">Ouracle</a>

  <div class="trail" aria-hidden="true"></div>
</header>

<style>
.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: calc(env(safe-area-inset-top, 0px) + 0.6rem) 1rem 0.6rem;
  border-bottom: 1px solid var(--glass-border);
  background: var(--glass-wash), color-mix(in srgb, var(--glass-bg-strong) 92%, transparent);
  position: sticky;
  top: 0;
  z-index: 30;
  height: var(--topbar-h, 57px);
  box-sizing: border-box;
  transition: opacity 0.4s ease;
  backdrop-filter: blur(calc(var(--glass-blur) + 2px)) saturate(var(--glass-saturate));
  -webkit-backdrop-filter: blur(calc(var(--glass-blur) + 2px)) saturate(var(--glass-saturate));
}

:global(html.modal-open) .topbar {
  opacity: 0;
}

.menu-btn {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 5px;
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  width: 36px;
  height: 36px;
  flex-shrink: 0;
}

.menu-btn span {
  display: block;
  width: 100%;
  height: 1px;
  background: var(--muted);
  transform-origin: center;
  transition: transform 0.22s ease, opacity 0.22s ease, background 0.15s;
}

.menu-btn:hover span { background: var(--text); }
.menu-btn span:nth-child(1).open { transform: translateY(6px) rotate(45deg); }
.menu-btn span:nth-child(2).open { opacity: 0; transform: scaleX(0); }
.menu-btn span:nth-child(3).open { transform: translateY(-6px) rotate(-45deg); }

.wordmark {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  font-family: var(--font-display);
  font-size: 1.02rem;
  letter-spacing: 0.08em;
  color: var(--accent);
  text-decoration: none;
  white-space: nowrap;
  transition: opacity 0.15s;
  font-weight: 500;
}

.wordmark:hover { opacity: 0.75; }

.trail {
  width: 36px;
}
</style>
