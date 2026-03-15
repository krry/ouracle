<script lang="ts">
  import { authed, guestTurns } from '$lib/stores';
  import { GUEST_LIMIT } from '$lib/guestSession';
  import Reception from '$lib/Reception.svelte';
  import Chat from '$lib/Chat.svelte';
  import AltarOverlay from '$lib/AltarOverlay.svelte';

  let wantsSignin = $state(false);
  $effect(() => { if ($authed) wantsSignin = false; });
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
