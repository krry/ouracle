<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { controlPanelRouteById } from '$lib/ControlPanel.svelte';

  onMount(() => {
    goto(controlPanelRouteById.oracle.href, {
      replaceState: true,
      noScroll: true,
      keepFocus: true
    });
  });
</script>

<svelte:head>
  <title>Enquire | Ouracle</title>
</svelte:head>
