<script lang="ts">
  import { onMount } from 'svelte';
  import { authed, creds, guestTurns, covenantReady, needsCovenant } from '$lib/stores';
  import { GUEST_LIMIT } from '$lib/guestSession';
  import { authClient } from '$lib/auth';
  import Reception from '$lib/Reception.svelte';
  import Chat from '$lib/Chat.svelte';
  import AltarOverlay from '$lib/AltarOverlay.svelte';
  import Covenant from '$lib/Covenant.svelte';

  let wantsSignin = $state(false);
  let exchanging = $state(false);
  $effect(() => { if ($authed) wantsSignin = false; });

  // Sync BetterAuth session cookie → our JWT after OAuth redirect
  onMount(async () => {
    if ($authed) return;
    const BASE = import.meta.env.VITE_OURACLE_BASE_URL ?? 'https://api.ouracle.kerry.ink';
    const { data } = await authClient.getSession();
    if (!data?.session?.token) return;
    exchanging = true;
    try {
      const r = await fetch(`${BASE}/auth/social-exchange`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_token: data.session.token }),
      });
      if (!r.ok) return;
      const { seeker_id, access_token, refresh_token, handle, stage } = await r.json();
      if (access_token && seeker_id) creds.login({ access_token, refresh_token: refresh_token ?? '', seeker_id, handle, stage });
    } finally {
      exchanging = false;
    }
  });

  function handleCovenantAccepted() {
    // API call happens in Covenant.svelte — just update local state
    if ($creds) {
      creds.login({ ...$creds, stage: 'covenanted' });
    }
    covenantReady.set(false);
    needsCovenant.set(false);
  }
</script>

<svelte:head>
  <style>html, body { height: 100%; overflow: hidden; }</style>
</svelte:head>

<div class="chat-stage">
  <Chat guestMode={!$authed} />
  {#if !$authed && !exchanging && $guestTurns >= GUEST_LIMIT && !wantsSignin}
    <AltarOverlay onsignin={() => (wantsSignin = true)} />
  {/if}
  {#if $covenantReady}
    <Covenant onaccept={handleCovenantAccepted} />
  {/if}
</div>

{#if wantsSignin}
  <Reception onclose={() => (wantsSignin = false)} />
{/if}

<style>
.chat-stage {
  position: relative;
  height: 100%;
  overflow: hidden;
}
</style>
