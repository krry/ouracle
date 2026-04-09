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
      error = e instanceof Error ? e.message : 'Could not load your records.';
    } finally {
      loading = false;
    }
  });

  async function handleRedact(sessionId: string) {
    if (!$creds) return;
    redacting = new Set([...redacting, sessionId]);
    try {
      await redactSession($creds.seeker_id, sessionId, $creds.access_token);
      sessions = sessions.map((s) =>
        s.id === sessionId ? { ...s, rite_name: null, rite_json: null, report: null } : s
      );
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
      goto(controlPanelRouteById.welcome.href);
    } catch (e) {
      error = e instanceof Error ? e.message : 'Could not delete account.';
      confirmDelete = false;
    }
  }

  function formatDate(iso: string | null): string {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  }

  const completeSessions = $derived(sessions.filter((s) => s.stage === 'complete'));
  const hasAny = $derived(completeSessions.length > 0);
</script>

<svelte:head>
  <title>Records | Ouracle</title>
</svelte:head>

<main class="thread-page">
  <header class="thread-header">
    <a href={controlPanelRouteById.oracle.href} class="back">← oracle</a>
    <h1 class="thread-title">the records</h1>
  </header>

  {#if loading}
    <div class="loading">reading…</div>
  {:else if error}
    <div class="error">{error}</div>
  {:else if !hasAny}
    <div class="empty">
      <p>No rites sealed yet. Begin your first session.</p>
      <a href={controlPanelRouteById.oracle.href} class="begin-link">enter</a>
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
}

.quality,
.enacted,
.redacted-notice {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  letter-spacing: 0.06em;
  text-transform: lowercase;
  color: var(--muted);
}

.enacted.yes { color: var(--accent); }
.enacted.no { color: var(--muted); }

.report {
  margin: 0.25rem 0 0;
  padding-left: 1rem;
  border-left: 1px solid var(--border);
  color: var(--text);
}

.redact-btn,
.delete-btn,
.delete-final,
.cancel-btn {
  width: fit-content;
  background: transparent;
  border: 1px solid var(--border);
  color: var(--muted);
  border-radius: 999px;
  padding: 0.45rem 0.75rem;
  font-family: var(--font-mono);
  font-size: 0.68rem;
  letter-spacing: 0.08em;
  text-transform: lowercase;
  cursor: pointer;
}

.redact-btn:hover,
.delete-btn:hover,
.cancel-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.delete-final {
  border-color: hsl(0 64% 58% / 0.5);
  color: hsl(0 72% 68%);
}

.thread-footer {
  margin-top: var(--space-lg);
}

.delete-confirm {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: center;
  color: var(--muted);
  font-family: var(--font-mono);
  font-size: 0.72rem;
}
</style>
