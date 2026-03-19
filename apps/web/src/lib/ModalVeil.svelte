<script lang="ts">
  import { createEventDispatcher, onDestroy } from 'svelte';

  export let active: boolean;
  export let component: any;
  export let close: (() => void) | undefined = undefined;

  const dispatch = createEventDispatcher();

  const BACKDROP_MS = 800;
  const CONTENT_MS = 300;

  type Phase =
    | 'hidden'
    | 'backdrop-entering'
    | 'content-entering'
    | 'visible'
    | 'content-exiting'
    | 'backdrop-exiting';

  let phase: Phase = 'hidden';
  let currentComponent = component;
  let timer: ReturnType<typeof setTimeout> | null = null;

  function clearTimer() {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  }

  function startEnter() {
    clearTimer();
    phase = 'backdrop-entering';
    timer = setTimeout(() => {
      phase = 'content-entering';
      timer = setTimeout(() => {
        phase = 'visible';
      }, CONTENT_MS);
    }, BACKDROP_MS);
  }

  function startExit() {
    clearTimer();
    phase = 'content-exiting';
    timer = setTimeout(() => {
      phase = 'backdrop-exiting';
      timer = setTimeout(() => {
        phase = 'hidden';
        dispatch('exited');
      }, BACKDROP_MS);
    }, CONTENT_MS);
  }

  $: if (active) {
    if (phase === 'hidden') {
      startEnter();
    } else if (phase === 'content-exiting' || phase === 'backdrop-exiting') {
      clearTimer();
      startEnter();
    }
  } else if (phase !== 'hidden') {
    startExit();
  }

  $: if (active && component !== currentComponent) {
    if (phase === 'visible' || phase === 'content-entering') {
      clearTimer();
      phase = 'content-exiting';
      timer = setTimeout(() => {
        currentComponent = component;
        phase = 'content-entering';
        timer = setTimeout(() => {
          phase = 'visible';
        }, CONTENT_MS);
      }, CONTENT_MS);
    } else if (phase === 'backdrop-entering') {
      currentComponent = component;
    }
  }

  onDestroy(clearTimer);

  $: backdropClass = phase === 'backdrop-entering'
    ? 'backdrop-enter'
    : phase === 'backdrop-exiting'
    ? 'backdrop-exit'
    : phase === 'hidden'
    ? 'hidden'
    : 'visible';

  $: contentVisible = phase === 'content-entering' || phase === 'visible';
</script>

<div class="veil-wrapper">
  <div
    class="backdrop {backdropClass}"
    onclick={close ?? undefined}
  ></div>
  <div class="content" class:visible={contentVisible} onclick={(e) => e.stopPropagation()}>
    {#if phase !== 'hidden' && currentComponent}
      <svelte:component this={currentComponent} {...$$restProps} />
    {/if}
  </div>
</div>

<style>
  .veil-wrapper {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
    pointer-events: none;
  }

  .backdrop {
    position: absolute;
    inset: 0;
    z-index: 0;
    background: color-mix(in srgb, var(--bg) 42%, transparent);
    opacity: 0;
    transition: opacity 0.8s ease;
    pointer-events: none;
  }

  .backdrop.backdrop-enter,
  .backdrop.visible {
    opacity: 1;
    pointer-events: auto;
  }

  .backdrop.backdrop-exit {
    opacity: 0;
  }

  .backdrop.hidden {
    display: none;
  }

  .content {
    position: relative;
    z-index: 1;
    pointer-events: auto;
    opacity: 0;
    filter: blur(18px);
    transform: scale(0.96);
    transition: opacity 0.3s ease, transform 0.3s ease, filter 0.3s ease;
  }

  .content.visible {
    opacity: 1;
    filter: blur(0);
    transform: scale(1);
  }
</style>
