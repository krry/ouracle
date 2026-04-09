<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { controlPanelRouteById } from '$lib/ControlPanel.svelte';

  onMount(() => {
    goto(controlPanelRouteById.devs.href, {
      replaceState: true,
      noScroll: true,
      keepFocus: true
    });
  });
</script>

<svelte:head>
  <title>ripl | Ouracle</title>
</svelte:head>
