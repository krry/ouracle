<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { creds, authed } from '$lib/stores';
  import { getThread, redactSession, deleteAccount } from '$lib/api';
  import type { ThreadSession } from '$lib/api';
  import { controlPanelRouteById } from '$lib/ControlPanel.svelte';

  let sessions = $state<ThreadSession[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let confirmDelete = $state(false);
  let redacting = $state<Set<string>>(new Set());

  onMount(async () => {
    if (!$authed || !$creds) {
      goto(controlPanelRouteById.draw.href);
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

  async function handleRedact(sessionId: string) {
    if (!$creds) return;
    redacting = new Set([...redacting, sessionId]);
    try {
      await redactSession($creds.seeker_id, sessionId, $creds.access_token);
      sessions = sessions.map(s =>
        s.id === sessionId ? { ...s, rite_name: null, rite_json: null, report: null } : s
      );
    } catch {
      // silent — the session remains visible; no crash
    } finally {
      const next = new Set(redacting);
      next.delete(sessionId);
      redacting = next;
    }
  }

  async function handleDeleteAccount() {
    if (!$creds) return;
    try {
      await deleteAccount($creds.seeker_id, $creds.access_token);
      creds.logout();
      goto('/');
    } catch (e) {
      error = e instanceof Error ? e.message : 'Could not delete account.';
      confirmDelete = false;
    }
  }

  function formatDate(iso: string | null): string {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'long', day: 'numeric', year: 'numeric'
    });
  }

  const completeSessions = $derived(sessions.filter(s => s.stage === 'complete'));
  const hasAny = $derived(completeSessions.length > 0);
</script>

<svelte:head>
  <title>Thread | Ouracle</title>
</svelte:head>

<main class="thread-page">
  <header class="thread-header">
    <a href={controlPanelRouteById.draw.href} class="back">← draw</a>
    <h1 class="thread-title">the thread</h1>
  </header>

  {#if loading}
    <div class="loading">reading…</div>

  {:else if error}
    <div class="error">{error}</div>

  {:else if !hasAny}
    <div class="empty">
      <p>The thread is empty. Begin your first session.</p>
      <a href={controlPanelRouteById.draw.href} class="begin-link">enter</a>
    </div>

  {:else}
    <ol class="sessions">
      {#each completeSessions as s (s.id)}
        <li class="session" class:redacted={!s.rite_name}>
          <time class="session-date">{formatDate(s.completed_at ?? s.created_at)}</time>

          {#if s.rite_name}
            <div class="rite-name">{s.rite_name}</div>
            {#if s.quality}
              <div class="quality">{s.quality}</div>
            {/if}
            {#if s.enacted !== null}
              <div class="enacted" class:yes={s.enacted} class:no={!s.enacted}>
                {s.enacted ? 'enacted' : 'not yet enacted'}
              </div>
            {/if}
            {#if s.report}
              <blockquote class="report">{s.report}</blockquote>
            {/if}
            <button
              class="redact-btn"
              disabled={redacting.has(s.id)}
              onclick={() => handleRedact(s.id)}
            >{redacting.has(s.id) ? '…' : 'redact'}</button>
          {:else}
            <div class="redacted-notice">this entry has been redacted.</div>
          {/if}
        </li>
      {/each}
    </ol>

    <footer class="thread-footer">
      {#if !confirmDelete}
        <button class="delete-btn" onclick={() => confirmDelete = true}>
          delete account
        </button>
      {:else}
        <div class="delete-confirm">
          <span>this cannot be undone.</span>
          <button class="delete-final" onclick={handleDeleteAccount}>yes, delete everything</button>
          <button class="cancel-btn" onclick={() => confirmDelete = false}>cancel</button>
        </div>
      {/if}
    </footer>
  {/if}
</main>

<style>
.thread-page {
  max-width: var(--max-prose);
  margin: 0 auto;
  padding: var(--topbar-h) var(--space-md) var(--space-xl);
  min-height: 100dvh;
}

.thread-header {
  display: flex;
  align-items: baseline;
  gap: var(--space-md);
  margin-bottom: var(--space-lg);
  padding-top: var(--space-md);
}

.back {
  font-family: var(--font-mono);
  font-size: 0.72rem;
  letter-spacing: 0.08em;
  color: var(--muted);
  text-decoration: none;
  transition: color 0.15s;
}
.back:hover { color: var(--accent); }

.thread-title {
  font-family: var(--font-display);
  font-size: 1.4rem;
  font-weight: 400;
  letter-spacing: 0.15em;
  color: var(--muted);
  margin: 0;
}

.loading, .error, .empty {
  color: var(--muted);
  font-family: var(--font-display);
  font-style: italic;
  text-align: center;
  padding: var(--space-xl) 0;
}

.begin-link {
  display: inline-block;
  margin-top: var(--space-md);
  font-family: var(--font-display);
  font-size: 1.1rem;
  color: var(--accent);
  text-decoration: none;
  letter-spacing: 0.12em;
}

.sessions {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0;
}

.session {
  padding: var(--space-md) 0;
  border-top: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.session:last-child {
  border-bottom: 1px solid var(--border);
}

.session-date {
  font-family: var(--font-mono);
  font-size: 0.65rem;
  letter-spacing: 0.1em;
  color: var(--muted);
  opacity: 0.7;
}

.rite-name {
  font-family: var(--font-display);
  font-size: 1.15rem;
  font-weight: 500;
  color: var(--text);
  line-height: 1.3;
}

.quality {
  font-family: var(--font-mono);
  font-size: 0.65rem;
  letter-spacing: 0.12em;
  color: var(--accent);
  text-transform: uppercase;
  opacity: 0.8;
}

.enacted {
  font-family: var(--font-mono);
  font-size: 0.65rem;
  letter-spacing: 0.1em;
  opacity: 0.6;
}
.enacted.yes { color: var(--accent); }
.enacted.no  { color: var(--muted); }

.report {
  margin: 0.25rem 0 0;
  padding-left: var(--space-sm);
  border-left: 2px solid var(--border);
  font-family: var(--font-display);
  font-style: italic;
  font-size: 0.9rem;
  line-height: var(--leading);
  color: var(--muted);
}

.redacted-notice {
  font-family: var(--font-display);
  font-style: italic;
  font-size: 0.85rem;
  color: var(--muted);
  opacity: 0.45;
}

.redact-btn {
  align-self: flex-start;
  margin-top: 0.25rem;
  background: none;
  border: none;
  font-family: var(--font-mono);
  font-size: 0.6rem;
  letter-spacing: 0.1em;
  color: var(--muted);
  opacity: 0.4;
  cursor: pointer;
  padding: 0;
  transition: opacity 0.15s, color 0.15s;
}
.redact-btn:hover:not(:disabled) {
  opacity: 1;
  color: var(--text);
}
.redact-btn:disabled { cursor: default; }

.thread-footer {
  margin-top: var(--space-xl);
  padding-top: var(--space-md);
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-sm);
}

.delete-btn {
  background: none;
  border: none;
  font-family: var(--font-mono);
  font-size: 0.65rem;
  letter-spacing: 0.1em;
  color: var(--muted);
  opacity: 0.3;
  cursor: pointer;
  padding: 0;
  transition: opacity 0.15s;
}
.delete-btn:hover { opacity: 0.8; }

.delete-confirm {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  flex-wrap: wrap;
}

.delete-confirm span {
  font-family: var(--font-display);
  font-style: italic;
  font-size: 0.85rem;
  color: var(--muted);
}

.delete-final {
  background: none;
  border: 1px solid color-mix(in srgb, var(--text) 30%, transparent);
  border-radius: var(--radius);
  font-family: var(--font-mono);
  font-size: 0.65rem;
  letter-spacing: 0.08em;
  color: var(--text);
  cursor: pointer;
  padding: 0.35rem 0.75rem;
  transition: border-color 0.15s, color 0.15s;
}
.delete-final:hover {
  border-color: var(--text);
}

.cancel-btn {
  background: none;
  border: none;
  font-family: var(--font-mono);
  font-size: 0.65rem;
  letter-spacing: 0.08em;
  color: var(--muted);
  cursor: pointer;
  padding: 0;
  transition: color 0.15s;
}
.cancel-btn:hover { color: var(--text); }
</style>
