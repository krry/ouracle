<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { authed } from '$lib/stores';
  import { controlPanelRouteById } from '$lib/ControlPanel.svelte';

  onMount(() => {
    goto($authed ? controlPanelRouteById.oracle.href : controlPanelRouteById.draw.href, {
      replaceState: true,
      noScroll: true,
      keepFocus: true
    });
  });
</script>

<svelte:head>
  <title>Enquire | Ouracle</title>
</svelte:head>
