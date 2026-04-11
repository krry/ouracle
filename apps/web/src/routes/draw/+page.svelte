<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { authed } from '$lib/stores';
  import { controlPanelRouteById } from '$lib/ControlPanel.svelte';
  import EnquireView from '$lib/EnquireView.svelte';

  onMount(() => {
    if ($authed) {
      goto(controlPanelRouteById.oracle.href, {
        replaceState: true,
        noScroll: true,
        keepFocus: true
      });
    }
  });
</script>

<svelte:head>
  <title>Draw | Ouracle</title>
  <style>html, body { height: 100%; overflow: hidden; } .app-content { overflow: hidden; }</style>
</svelte:head>

<EnquireView />
