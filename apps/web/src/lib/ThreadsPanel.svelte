<script lang="ts">
  import { onMount } from 'svelte';
  import { authed, creds } from './stores';
  import { getThread } from './api';
  import type { ThreadSession } from './api';
  import { controlPanelRouteById } from './ControlPanel.svelte';

  let sessions = $state<ThreadSession[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);

  onMount(async () => {
    if (!$authed || !$creds) {
      loading = false;
      return;
    }

    try {
      sessions = await getThread($creds.seeker_id, $creds.access_token);
    } catch (e) {
      error = e instanceof Error ? e.message : 'Could not load your thread.';
    } finally {
      loading = false;
    }
  });

  function formatDate(iso: string | null): string {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }

  const completeSessions = $derived(sessions.filter((s) => s.stage === 'complete'));
</script>

<section class="threads-panel rail-shell">
  <header class="tp-header">
    <div>
      <div class="tp-kicker">Thread</div>
      <h3>Past rites</h3>
    </div>
    <a href={controlPanelRouteById.records.href} class="tp-link">open thread</a>
  </header>

  {#if !$authed}
    <p class="tp-empty">Sign in to seal and revisit your sessions.</p>
  {:else if loading}
    <p class="tp-empty">reading…</p>
  {:else if error}
    <p class="tp-empty">{error}</p>
  {:else if completeSessions.length === 0}
    <p class="tp-empty">No completed rites yet.</p>
  {:else}
    <ol class="tp-list">
      {#each completeSessions as session (session.id)}
        <li class="tp-item">
          <div class="tp-date">{formatDate(session.completed_at ?? session.created_at)}</div>
          <div class="tp-title">{session.rite_name ?? 'Redacted rite'}</div>
          {#if session.quality}
            <div class="tp-quality">{session.quality}</div>
          {/if}
          {#if session.report}
            <p class="tp-report">{session.report}</p>
          {/if}
        </li>
      {/each}
    </ol>
  {/if}
</section>

<style>
.threads-panel {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  padding: 1rem;
  min-height: 0;
}

.tp-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.tp-kicker {
  font-family: var(--font-mono);
  font-size: 0.62rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--muted);
  font-weight: 300;
}

.tp-header h3 {
  margin: 0.2rem 0 0;
  font-family: var(--font-mono);
  font-size: 0.86rem;
  font-weight: 500;
  letter-spacing: 0.03em;
  text-transform: lowercase;
}

.tp-link {
  font-family: var(--font-mono);
  font-size: 0.62rem;
  letter-spacing: 0.08em;
  text-transform: lowercase;
  color: var(--accent);
  text-decoration: none;
  font-weight: 500;
}

.tp-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
  max-height: 100%;
  overflow-y: auto;
}

.tp-item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: 0.8rem 0.85rem;
  border-radius: 16px;
  background: color-mix(in srgb, var(--surface) 76%, transparent);
  border: 1px solid color-mix(in srgb, var(--glass-border) 80%, transparent);
}

.tp-date,
.tp-quality {
  font-family: var(--font-mono);
  font-size: 0.6rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--muted);
}

.tp-title {
  font-family: var(--font-mono);
  font-size: clamp(0.68rem, 0.62rem + 0.16vw, 0.82rem);
  color: var(--text);
  letter-spacing: 0.03em;
  font-weight: 600;
}

.tp-report,
.tp-empty {
  margin: 0;
  font-size: clamp(0.78rem, 0.72rem + 0.14vw, 0.92rem);
  line-height: 1.55;
  color: var(--muted);
  max-width: min(100%, clamp(36ch, 92%, 72ch));
}
</style>
