<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { authed } from '$lib/stores';
  import { controlPanelRouteById } from '$lib/ControlPanel.svelte';
  import EnquireView from '$lib/EnquireView.svelte';

  onMount(() => {
    if (!$authed) {
      goto(controlPanelRouteById.draw.href);
    }
  });
</script>

<svelte:head>
  <title>Oracle | Ouracle</title>
  <style>html, body { height: 100%; overflow: hidden; } .app-content { overflow: hidden; }</style>
</svelte:head>

<EnquireView />
