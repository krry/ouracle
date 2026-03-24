<script lang="ts">
  import { onMount } from 'svelte';
  import { authed, creds, guestTurns, covenantReady, needsCovenant } from '$lib/stores';
  import Nebula from '$lib/Nebula.svelte';
  import { GUEST_LIMIT } from '$lib/guestSession';
  import { authClient } from '$lib/auth';
  import Reception from '$lib/Reception.svelte';
  import AltarOverlay from '$lib/AltarOverlay.svelte';
  import Covenant from '$lib/Covenant.svelte';
  import Chat from '$lib/Chat.svelte';
  import ModalVeil from '$lib/ModalVeil.svelte';

  let wantsSignin = $state(false);
  let exchanging = $state(false);
  let altarDismissed = $state(false);

  $effect(() => { if ($authed) wantsSignin = false; });

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
    if ($creds) {
      creds.login({ ...$creds, stage: 'covenanted' });
    }
    covenantReady.set(false);
    needsCovenant.set(false);
  }

  // Modal Veil logic
  const handleEnter = () => {
    altarDismissed = true;
    wantsSignin = true;
  };
  const handleAltarClose = () => {
    altarDismissed = true;
  };
  const handleClose = () => { wantsSignin = false; };

    const thresholdReached = $derived(!$authed && !exchanging && $guestTurns >= GUEST_LIMIT);
    const showAltarOverlay = $derived(thresholdReached && !wantsSignin && !altarDismissed);
    const guestLocked = $derived(thresholdReached && altarDismissed);
    const modalActive = $derived(showAltarOverlay || wantsSignin);

    $effect(() => {
      if ($authed || $guestTurns < GUEST_LIMIT) {
        altarDismissed = false;
      }
    });

    // Add class to html element for global styling (e.g., fade topbar)
    $effect(() => {
      document.documentElement.classList.toggle('modal-open', modalActive);

      return () => {
        document.documentElement.classList.remove('modal-open');
      };
    });
    const modalComponent = $derived(showAltarOverlay ? AltarOverlay : Reception);
    // For Altar, backdrop click should do nothing (no close). For Reception, it should close.
    const backdropClose = $derived(wantsSignin ? handleClose : undefined);
</script>

<svelte:head>
  <title>Aspire | Ouracle</title>
  <style>html, body { height: 100%; overflow: hidden; }</style>
</svelte:head>

<div class="nebula-bg" aria-hidden="true">
  <Nebula opacity={0.18} />
</div>

<div class="content-wrapper" class:blurred={modalActive}>
  <div class="chat-stage">
    <Chat guestMode={!$authed} guestLocked={guestLocked} onsignin={handleEnter} />
  </div>
</div>

{#if modalActive}
  <ModalVeil
    active={true}
    component={modalComponent}
    close={backdropClose}
    onsignin={handleEnter}
    ondismiss={handleAltarClose}
    onclose={handleClose}
  />
{/if}

{#if $covenantReady}
  <Covenant onaccept={handleCovenantAccepted} />
{/if}

<style>
  .nebula-bg {
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: 0;
  }

  .content-wrapper {
    position: relative;
    z-index: 1;
    height: 100%;
  }
  .content-wrapper.blurred .chat-stage {
    filter: blur(10px) saturate(180%);
    transition: filter 0.8s ease;
  }
  .chat-stage {
    position: relative;
    height: 100%;
    overflow: hidden;
  }
</style>
