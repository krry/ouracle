<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { authed, creds, guestTurns, covenantReady, needsCovenant, covenantAcceptedTick, covenantPromptArmed } from '$lib/stores';
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

  const signinRequested = $derived($page.url.searchParams.get('signin') === '1');
  const freshRequested = $derived($page.url.searchParams.get('fresh') === '1');

  $effect(() => {
    if ($authed) {
      wantsSignin = false;
      return;
    }
    if (signinRequested) wantsSignin = true;
  });

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
    covenantPromptArmed.disarm();
    covenantAcceptedTick.update((n) => n + 1);
  }

  const handleEnter = () => {
    altarDismissed = true;
    wantsSignin = true;
  };

  const handleAltarClose = () => {
    altarDismissed = true;
  };

  async function clearSigninParam() {
    if (!signinRequested) return;
    await clearQueryParam('signin');
  }

  async function clearFreshParam() {
    if (!freshRequested) return;
    await clearQueryParam('fresh');
  }

  async function clearQueryParam(name: string) {
    const url = new URL($page.url);
    url.searchParams.delete(name);
    await goto(`${url.pathname}${url.search}${url.hash}`, {
      replaceState: true,
      noScroll: true,
      keepFocus: true
    });
  }

  const handleClose = async () => {
    wantsSignin = false;
    await clearSigninParam();
  };

  const handleFreshHandled = async () => {
    await clearFreshParam();
  };

  const thresholdReached = $derived(!$authed && !exchanging && $guestTurns >= GUEST_LIMIT);
  const showAltarOverlay = $derived(thresholdReached && !wantsSignin && !altarDismissed);
  const guestLocked = $derived(thresholdReached && altarDismissed);
  const modalActive = $derived(showAltarOverlay || wantsSignin);

  $effect(() => {
    if ($authed || $guestTurns < GUEST_LIMIT) {
      altarDismissed = false;
    }
  });

  $effect(() => {
    if ($authed && signinRequested) {
      clearSigninParam().catch(() => {});
    }
  });

  $effect(() => {
    if ($authed && $covenantPromptArmed) {
      covenantReady.set(true);
    }
  });

  $effect(() => {
    document.documentElement.classList.toggle('modal-open', modalActive);

    return () => {
      document.documentElement.classList.remove('modal-open');
    };
  });

  const modalComponent = $derived(showAltarOverlay ? AltarOverlay : Reception);
  const backdropClose = $derived(wantsSignin ? handleClose : undefined);
</script>

<div class="content-wrapper" class:blurred={modalActive}>
  <div class="chat-stage">
    <Chat
      guestMode={!$authed}
      guestLocked={guestLocked}
      freshStart={freshRequested && $authed}
      onsignin={handleEnter}
      onfreshhandled={handleFreshHandled}
    />
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

  {#if $covenantReady && $covenantPromptArmed}
  <Covenant onaccept={handleCovenantAccepted} />
{/if}

<style>
  .content-wrapper {
    position: relative;
    z-index: 1;
    height: 100%;
    isolation: isolate;
  }

  .content-wrapper::before {
    content: '';
    position: absolute;
    inset: 0;
    pointer-events: none;
    background:
      linear-gradient(180deg, color-mix(in srgb, var(--glass-bg) 88%, transparent), transparent 28%),
      linear-gradient(180deg, transparent 0%, color-mix(in srgb, var(--bg) 14%, transparent) 100%);
    z-index: 0;
  }

  .content-wrapper.blurred .chat-stage {
    filter: blur(10px) saturate(180%);
    transition: filter 0.8s ease;
  }

  .chat-stage {
    position: relative;
    z-index: 1;
    height: 100%;
    overflow: hidden;
  }
</style>
