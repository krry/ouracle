<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { creds, authed } from '$lib/stores';
  import { loadSingleRecord, reportText, type MergedFullRecord } from '$lib/records';
  import { controlPanelRouteById } from '$lib/ControlPanel.svelte';

  let record = $state<MergedFullRecord | null>(null);
  let loading = $state(true);
  let error = $state<string | null>(null);

  const sessionId = $derived($page.params.id ?? '');

  onMount(async () => {
    if (!$authed || !$creds) {
      goto(`${controlPanelRouteById.draw.href}?signin=1`);
      return;
    }
    try {
      record = await loadSingleRecord(sessionId, $creds.seeker_id, $creds.access_token);
    } catch (e) {
      error = e instanceof Error ? e.message : 'Could not unseal this record.';
    } finally {
      loading = false;
    }
  });

  function formatDate(iso: string | null | undefined): string {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'long', day: 'numeric', year: 'numeric',
    });
  }

  function vagalLabel(v: string | null): string {
    const map: Record<string, string> = {
      ventral: 'ventral — safe, open, connected',
      sympathetic: 'sympathetic — mobilized, urgent',
      dorsal: 'dorsal — shutdown, frozen',
      mixed: 'mixed — split activation',
    };
    return v ? (map[v] ?? v) : '—';
  }

  function valenceLabel(v: number): string {
    if (v > 0.4) return 'positive';
    if (v < -0.4) return 'negative';
    return 'neutral';
  }

  function arousalLabel(a: number): string {
    if (a > 0.4) return 'activated';
    if (a < -0.4) return 'deactivated';
    return 'moderate';
  }

  const summaryText = $derived(record ? (reportText(record.report) ?? record.encrypted_note) : null);
  const riteName = $derived(record?.encrypted_rite_name ?? record?.rite_name ?? null);
  const quality = $derived(record?.encrypted_quality ?? record?.quality ?? null);
</script>

<svelte:head>
  <title>{riteName ?? 'Record'} | Ouracle</title>
</svelte:head>

<main class="record-page">
  <header class="record-header">
    <a href="/records" class="back">← records</a>
    {#if record}
      <time class="record-date">{formatDate(record.completed_at ?? record.prescribed_at ?? record.created_at)}</time>
    {/if}
  </header>

  {#if loading}
    <div class="state-msg">unsealing…</div>

  {:else if error}
    <div class="state-msg error">{error}</div>

  {:else if record}
    <article class="record-body">

      <!-- Rite name -->
      {#if riteName}
        <h1 class="rite-name">{riteName}</h1>
      {:else}
        <h1 class="rite-name redacted">redacted</h1>
      {/if}

      <!-- Meta row: quality · stage · enacted -->
      <div class="meta-row">
        {#if quality}
          <span class="tag tag-quality">{quality}</span>
        {/if}
        <span class="tag">{record.stage === 'prescribed' ? 'received' : 'enacted'}</span>
        {#if record.enacted !== null}
          <span class="tag" class:tag-yes={record.enacted} class:tag-no={!record.enacted}>
            {record.enacted ? 'rite enacted' : 'not yet enacted'}
          </span>
        {/if}
      </div>

      <!-- Enquiry summary / note -->
      {#if summaryText}
        <section class="record-section">
          <h2 class="section-label">enquiry</h2>
          <blockquote class="record-quote">{summaryText}</blockquote>
        </section>
      {/if}

      <!-- Inferred state -->
      <section class="record-section">
        <h2 class="section-label">inferred state</h2>
        <dl class="state-grid">
          <div class="state-row">
            <dt>vagal</dt>
            <dd class="state-val" class:dim={!record.vagal_probable}>{vagalLabel(record.vagal_probable)}</dd>
          </div>
          <div class="state-row">
            <dt>belief</dt>
            <dd class="state-val" class:dim={!record.belief_pattern}>{record.belief_pattern ?? '—'}</dd>
          </div>
          {#if record.affect}
            <div class="state-row">
              <dt>affect</dt>
              <dd class="state-val">
                {record.affect.gloss}
                <span class="affect-coords">
                  {valenceLabel(record.affect.valence)} · {arousalLabel(record.affect.arousal)}
                </span>
              </dd>
            </div>
          {/if}
        </dl>
      </section>

      <!-- Rite -->
      {#if record.rite_json || record.rite_name}
        <section class="record-section">
          <h2 class="section-label">rite</h2>
          {#if record.rite_json}
            {@const rite = record.rite_json as Record<string, unknown>}
            {#if rite.act}
              <p class="rite-act">{rite.act}</p>
            {/if}
            {#if rite.context}
              <p class="rite-context">{rite.context}</p>
            {/if}
            {#if rite.duration}
              <p class="rite-meta">duration: {rite.duration}</p>
            {/if}
          {:else}
            <p class="rite-act">{record.rite_name}</p>
          {/if}
        </section>
      {/if}

      <!-- Seeker feedback -->
      {#if record.encrypted_feedback}
        <section class="record-section">
          <h2 class="section-label">your words</h2>
          <blockquote class="record-quote feedback-quote">"{record.encrypted_feedback}"</blockquote>
        </section>
      {/if}

      <!-- Beliefs -->
      {#if record.encrypted_beliefs.length}
        <section class="record-section">
          <h2 class="section-label">beliefs surfaced</h2>
          <ul class="beliefs">
            {#each record.encrypted_beliefs as belief}
              <li>{belief}</li>
            {/each}
          </ul>
        </section>
      {/if}

      <!-- Context note -->
      {#if record.encrypted_context}
        <section class="record-section">
          <h2 class="section-label">context</h2>
          <p class="context-text">{record.encrypted_context}</p>
        </section>
      {/if}

      <!-- Encrypted-only notice -->
      {#if !record.encrypted_note && !record.encrypted_feedback}
        <div class="device-notice">
          Encrypted details are sealed to this seeker's authenticated device.
          Sign in with the same account on another device to unlock them.
        </div>
      {/if}

    </article>
  {/if}
</main>

<style>
.record-page {
  max-width: var(--max-prose);
  margin: 0 auto;
  padding: var(--topbar-h) var(--space-md) var(--space-xl);
  min-height: 100dvh;
}

.record-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-md);
  padding-top: var(--space-md);
  margin-bottom: var(--space-lg);
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

.record-date {
  font-family: var(--font-mono);
  font-size: 0.65rem;
  letter-spacing: 0.1em;
  color: var(--muted);
  opacity: 0.6;
}

.state-msg {
  color: var(--muted);
  font-family: var(--font-display);
  font-style: italic;
  text-align: center;
  padding: var(--space-xl) 0;
}
.state-msg.error { color: hsl(0 60% 65%); font-style: normal; }

.record-body {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.rite-name {
  font-family: var(--font-display);
  font-size: 1.5rem;
  font-weight: 400;
  letter-spacing: 0.04em;
  margin: 0;
}
.rite-name.redacted {
  color: var(--muted);
  font-style: italic;
}

.meta-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.tag {
  font-family: var(--font-mono);
  font-size: 0.66rem;
  letter-spacing: 0.07em;
  text-transform: lowercase;
  color: var(--muted);
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 0.2rem 0.5rem;
}
.tag-quality {
  color: var(--accent);
  border-color: color-mix(in srgb, var(--accent) 35%, transparent);
}
.tag-yes { color: var(--accent); }
.tag-no  { opacity: 0.55; }

.record-section {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding-top: var(--space-sm);
  border-top: 1px solid var(--border);
}

.section-label {
  font-family: var(--font-mono);
  font-size: 0.62rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--muted);
  font-weight: 400;
  margin: 0;
  opacity: 0.7;
}

.record-quote {
  margin: 0;
  padding-left: 1rem;
  border-left: 2px solid color-mix(in srgb, var(--accent) 40%, transparent);
  color: var(--text);
  line-height: var(--leading);
}
.feedback-quote {
  font-style: italic;
  color: var(--muted);
}

.state-grid {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  margin: 0;
}

.state-row {
  display: grid;
  grid-template-columns: 5rem 1fr;
  gap: 0.5rem;
  align-items: baseline;
}

.state-row dt {
  font-family: var(--font-mono);
  font-size: 0.68rem;
  letter-spacing: 0.07em;
  text-transform: lowercase;
  color: var(--muted);
  opacity: 0.7;
}

.state-val {
  font-family: var(--font-mono);
  font-size: 0.78rem;
  color: var(--text);
  text-transform: lowercase;
}
.state-val.dim { color: var(--muted); opacity: 0.55; }

.affect-coords {
  display: block;
  font-size: 0.65rem;
  opacity: 0.6;
  margin-top: 0.1rem;
}

.rite-act {
  font-family: var(--font-display);
  font-size: 1rem;
  line-height: var(--leading);
  margin: 0;
}
.rite-context, .rite-meta {
  font-size: 0.88rem;
  color: var(--muted);
  line-height: var(--leading);
  margin: 0;
}
.rite-meta { font-family: var(--font-mono); font-size: 0.68rem; }

.beliefs {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}
.beliefs li {
  font-family: var(--font-mono);
  font-size: 0.66rem;
  letter-spacing: 0.05em;
  text-transform: lowercase;
  color: var(--muted);
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 0.22rem 0.48rem;
}

.context-text {
  color: var(--muted);
  font-size: 0.9rem;
  line-height: var(--leading);
  margin: 0;
}

.device-notice {
  font-family: var(--font-mono);
  font-size: 0.7rem;
  color: var(--muted);
  opacity: 0.55;
  line-height: 1.6;
  padding: var(--space-sm);
  border: 1px solid var(--border);
  border-radius: var(--radius);
}

</style>
