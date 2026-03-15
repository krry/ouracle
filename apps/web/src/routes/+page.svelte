<script lang="ts">
	import { authed } from '$lib/stores';
	import Reception from '$lib/Reception.svelte';
	import Chat from '$lib/Chat.svelte';
</script>

{#if $authed}
	<Chat />
{:else}
	<Reception />
{/if}
