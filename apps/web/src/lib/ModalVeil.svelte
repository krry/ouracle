<script lang="ts">
  import { untrack } from 'svelte';

  let {
    active,
    component,
    close = undefined,
    ...restProps
  }: {
    active: boolean;
    component: any;
    close?: (() => void) | undefined;
    [key: string]: unknown;
  } = $props();

  const BACKDROP_MS = 800;
  const CONTENT_MS  = 300;

  type Phase =
    | 'hidden'
    | 'backdrop-entering'
    | 'content-entering'
    | 'visible'
    | 'content-exiting'
    | 'backdrop-exiting';

  let phase: Phase          = $state<Phase>('hidden');
  let currentComponent: any = $state<any>(untrack(() => component));
  let timer: ReturnType<typeof setTimeout> | null = null;

  function clearTimer() {
    if (timer !== null) { clearTimeout(timer); timer = null; }
  }

  function startEnter() {
    clearTimer();
    phase = 'backdrop-entering';
    timer = setTimeout(() => {
      phase = 'content-entering';
      timer = setTimeout(() => { phase = 'visible'; }, CONTENT_MS);
    }, BACKDROP_MS);
  }

  function startExit() {
    clearTimer();
    phase = 'content-exiting';
    timer = setTimeout(() => {
      phase = 'backdrop-exiting';
      timer = setTimeout(() => { phase = 'hidden'; }, BACKDROP_MS);
    }, CONTENT_MS);
  }

  // React to `active` only — untrack `phase` so phase changes don't re-run this effect.
  $effect(() => {
    if (active) {
      const p = untrack(() => phase);
      if (p === 'hidden') {
        startEnter();
      } else if (p === 'content-exiting' || p === 'backdrop-exiting') {
        clearTimer();
        startEnter();
      }
    } else {
      const p = untrack(() => phase);
      if (p !== 'hidden') startExit();
    }
  });

  // React to `component` only — untrack everything else so phase changes don't re-run
  // this effect and cancel in-flight swaps (the Svelte 4 $: interference bug).
  $effect(() => {
    const next = component;
    if (!active) return;
    if (next === untrack(() => currentComponent)) return;

    const p = untrack(() => phase);
    if (p === 'visible' || p === 'content-entering') {
      clearTimer();
      phase = 'content-exiting';
      timer = setTimeout(() => {
        currentComponent = next;
        phase = 'content-entering';
        timer = setTimeout(() => { phase = 'visible'; }, CONTENT_MS);
      }, CONTENT_MS);
    } else if (p === 'backdrop-entering') {
      currentComponent = next;
    }
  });

  // Cleanup timers when component is destroyed
  $effect(() => () => clearTimer());

  const backdropClass = $derived(
    phase === 'backdrop-entering' ? 'backdrop-enter'
    : phase === 'backdrop-exiting'  ? 'backdrop-exit'
    : phase === 'hidden'            ? 'hidden'
    : 'visible'
  );

  const contentVisible = $derived(phase === 'content-entering' || phase === 'visible');
</script>

<div class="veil-wrapper">
  <div
    class="backdrop {backdropClass}"
    onclick={close ?? undefined}
  ></div>
  <div
    class="content"
    class:visible={contentVisible}
    onclick={(e) => e.stopPropagation()}
    onkeydown={(e) => { if (e.key === 'Escape' && close) close(); }}
    role="dialog"
    aria-modal="true"
    tabindex="-1"
  >
    {#if phase !== 'hidden' && currentComponent}
      {@const Modal = currentComponent}
      <Modal {...restProps} />
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
    border-radius: 18px;
  }

  .content:focus-visible {
    outline: 2px solid var(--focus-soft);
    outline-offset: 2px;
  }

  .content.visible {
    opacity: 1;
    filter: blur(0);
    transform: scale(1);
  }
</style>
