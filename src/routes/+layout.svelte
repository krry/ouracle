<script>
  import '../app.css';
  import { onMount } from 'svelte';
  import { initPWA } from '$lib/service-worker-registration.js';

  onMount(() => {
    // Initialize PWA service worker (skipped in dev mode automatically)
    initPWA();
  });
</script>

<svelte:head>
  <!-- PWA viewport with safe area support -->
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover, maximum-scale=1.0, user-scalable=no" />

  <!-- Theme color for mobile browser chrome -->
  <meta name="theme-color" content="#6366f1" media="(prefers-color-scheme: dark)" />
  <meta name="theme-color" content="#6366f1" media="(prefers-color-scheme: light)" />

  <!-- Apple PWA specific -->
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
  <meta name="apple-mobile-web-app-title" content="Ouracle" />

  <!-- Prevent duplicate scrollbars on mobile -->
  <meta name="scroll-restoration" content="position" />

  <!-- DNS prefetch for API -->
  <link rel="dns-prefetch" href="https://api.ouracle.kerry.ink" />
</svelte:head>

<main class="min-h-screen bg-[#0a0a0a] text-gray-100">
  <slot />
</main>