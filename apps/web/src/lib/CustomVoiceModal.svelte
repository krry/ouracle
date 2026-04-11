<script lang="ts">
  import { ttsVoice } from './stores';
  import { DEFAULT_VOICE } from './tts-client';

  let { onclose = () => {} }: { onclose?: () => void } = $props();

  // Pre-fill with current custom voice if one is set
  const currentId = $ttsVoice;
  const isCurrentCustom = /^[0-9a-f]{32}$/i.test(currentId);
  let input = $state(isCurrentCustom ? currentId : '');
  let error = $state('');

  /** Accept a Fish.audio URL (any known format) or a bare 32-char hex ID. */
  function parseVoiceId(raw: string): string | null {
    const s = raw.trim();
    // /app/m/{id}/ path format
    const pathMatch = s.match(/\/m\/([0-9a-f]{32})/i);
    if (pathMatch) return pathMatch[1].toLowerCase();
    // ?modelId={id} query-param format (share links from TTS page)
    const modelMatch = s.match(/[?&]modelId=([0-9a-f]{32})/i);
    if (modelMatch) return modelMatch[1].toLowerCase();
    // Bare 32-char hex UUID
    if (/^[0-9a-f]{32}$/i.test(s)) return s.toLowerCase();
    return null;
  }

  function apply() {
    const id = parseVoiceId(input);
    if (!id) {
      error = 'Paste a Fish.audio voice URL or a 32-character voice ID.';
      return;
    }
    ttsVoice.set(id);
    onclose();
  }

  function revert() {
    ttsVoice.set(DEFAULT_VOICE);
    onclose();
  }

  function onkeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') apply();
    if (e.key === 'Escape') onclose();
  }
</script>

<div class="cvm">
  <h2 class="cvm-title">use your voice</h2>

  <p class="cvm-body">
    Paste the URL of any voice on
    <a href="https://fish.audio" target="_blank" rel="noopener">fish.audio</a>
    — or the 32-character voice ID directly.
  </p>

  <p class="cvm-example">
    e.g.&nbsp;<code>https://fish.audio/app/text-to-speech/?modelId=<mark>[voice-id]</mark></code><br>
    &nbsp;or&nbsp;&nbsp;<code>https://fish.audio/app/m/<mark>[voice-id]</mark>/</code>
  </p>

  <input
    class="cvm-input"
    class:error={!!error}
    type="text"
    placeholder="voice URL or ID"
    bind:value={input}
    {onkeydown}
    autocomplete="off"
    spellcheck="false"
  />

  {#if error}
    <p class="cvm-error">{error}</p>
  {/if}

  <div class="cvm-actions">
    <button class="cvm-apply" onclick={apply}>use this voice</button>
    {#if isCurrentCustom}
      <button class="cvm-revert" onclick={revert}>use a preset</button>
    {/if}
  </div>

  <p class="cvm-clone">
    Want Clea to sound like you?
    <a href="https://fish.audio/app/voice-cloning/" target="_blank" rel="noopener">
      clone your voice →
    </a>
  </p>
</div>

<style>
.cvm {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 18px;
  padding: 2rem 2.2rem;
  max-width: 28rem;
  width: calc(100vw - 3rem);
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}

.cvm-title {
  font-family: var(--font-display);
  font-size: 1.15rem;
  font-weight: 500;
  color: var(--text);
  margin: 0;
}

.cvm-body {
  font-family: var(--font-display);
  font-size: 0.82rem;
  color: var(--muted);
  margin: 0;
  line-height: 1.55;
}

.cvm-body a,
.cvm-clone a {
  color: var(--accent);
  text-decoration: none;
}
.cvm-body a:hover,
.cvm-clone a:hover {
  text-decoration: underline;
}

.cvm-example {
  font-family: var(--font-mono);
  font-size: 0.62rem;
  color: var(--muted);
  margin: -0.3rem 0 0;
  letter-spacing: 0.02em;
  line-height: 1.5;
  overflow-wrap: break-word;
  word-break: break-all;
}
.cvm-example mark {
  background: color-mix(in srgb, var(--accent) 18%, transparent);
  color: var(--accent);
  border-radius: 3px;
  padding: 0 0.2em;
}

.cvm-input {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  letter-spacing: 0.04em;
  background: color-mix(in srgb, var(--bg) 72%, transparent);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 0.6rem 0.8rem;
  color: var(--text);
  width: 100%;
  box-sizing: border-box;
  outline: none;
  transition: border-color 0.15s;
}
.cvm-input:focus { border-color: var(--accent); }
.cvm-input.error { border-color: hsl(354, 70%, 52%); }

.cvm-error {
  font-family: var(--font-display);
  font-size: 0.72rem;
  color: hsl(354, 70%, 52%);
  margin: -0.4rem 0 0;
}

.cvm-actions {
  display: flex;
  gap: 0.65rem;
  align-items: center;
}

.cvm-apply {
  padding: 0.5rem 1.1rem;
  border-radius: 999px;
  border: 1px solid var(--accent);
  background: color-mix(in srgb, var(--accent) 14%, transparent);
  color: var(--accent);
  font-family: var(--font-mono);
  font-size: 0.68rem;
  letter-spacing: 0.07em;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}
.cvm-apply:hover {
  background: var(--accent);
  color: var(--bg);
}

.cvm-revert {
  background: none;
  border: none;
  padding: 0;
  color: var(--muted);
  font-family: var(--font-mono);
  font-size: 0.65rem;
  letter-spacing: 0.07em;
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 3px;
  transition: color 0.15s;
}
.cvm-revert:hover { color: var(--text); }

.cvm-clone {
  font-family: var(--font-display);
  font-size: 0.75rem;
  color: var(--muted);
  margin: 0.2rem 0 0;
}
</style>
