<script lang="ts">
  import { onMount } from 'svelte';
  import { authed, creds, guestTurns } from '$lib/stores';
  import { GUEST_LIMIT } from '$lib/guestSession';
  import { authClient } from '$lib/auth';
  import Reception from '$lib/Reception.svelte';
  import Chat from '$lib/Chat.svelte';
  import AltarOverlay from '$lib/AltarOverlay.svelte';

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
      const { seeker_id, access_token, refresh_token, handle } = await r.json();
      if (access_token && seeker_id) creds.login({ access_token, refresh_token: refresh_token ?? '', seeker_id, handle });
    } finally {
      exchanging = false;
    }
  });
</script>

<svelte:head>
  <style>html, body { height: 100%; overflow: hidden; }</style>
</svelte:head>

{#if $authed || !wantsSignin}
  <Chat guestMode={!$authed} />
  {#if !$authed && !exchanging && $guestTurns >= GUEST_LIMIT}
    <AltarOverlay onsignin={() => (wantsSignin = true)} />
  {/if}
{:else}
  <Reception />
{/if}
