<script lang="ts">
  import { onMount } from 'svelte';
  import { authed, creds, guestTurns } from '$lib/stores';
  import { GUEST_LIMIT } from '$lib/guestSession';
  import { authClient } from '$lib/auth';
  import Reception from '$lib/Reception.svelte';
  import Chat from '$lib/Chat.svelte';
  import AltarOverlay from '$lib/AltarOverlay.svelte';

  let wantsSignin = $state(false);
  $effect(() => { if ($authed) wantsSignin = false; });

  // Sync BetterAuth session cookie → localStorage after OAuth redirect
  onMount(async () => {
    if ($authed) return;
    const { data } = await authClient.getSession();
    if (data?.session?.token && data?.user?.id) {
      creds.login({ access_token: data.session.token, refresh_token: '', seeker_id: data.user.id });
    }
  });
</script>

<svelte:head>
  <style>html, body { height: 100%; overflow: hidden; }</style>
</svelte:head>

{#if $authed || !wantsSignin}
  <Chat guestMode={!$authed} />
  {#if !$authed && $guestTurns >= GUEST_LIMIT}
    <AltarOverlay on:signin={() => (wantsSignin = true)} />
  {/if}
{:else}
  <Reception />
{/if}
