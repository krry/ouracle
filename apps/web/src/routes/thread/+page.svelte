<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { controlPanelRouteById } from '$lib/ControlPanel.svelte';

  onMount(() => {
    goto(controlPanelRouteById.records.href, {
      replaceState: true,
      noScroll: true,
      keepFocus: true
    });
  });
</script>

<svelte:head>
  <title>Thread | Ouracle</title>
</svelte:head>
