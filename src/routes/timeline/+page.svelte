<script lang="ts">
	import { page } from '$app/state';
	import { DevicePicker } from '$lib/components/timeline';
	import UserMenu from '$lib/components/user-menu.svelte';

	const userName = $derived(page.data.userName as string | null);
</script>

<svelte:head>
	<title>Devices</title>
</svelte:head>

<div class="bg-background text-foreground min-h-screen">
	<header class="border-b">
		<div class="mx-auto flex max-w-6xl items-start justify-between gap-3 px-4 py-5 sm:px-6 lg:px-8">
			<div class="min-w-0 space-y-1.5">
				<h1 class="text-foreground text-xl font-semibold tracking-tight sm:text-2xl">
					Devices
				</h1>
				<p class="text-muted-foreground text-sm">
					Browse devices across your accounts and sub-accounts.
				</p>
			</div>
			{#if userName}
				<UserMenu {userName} />
			{/if}
		</div>
	</header>

	<main class="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
		<DevicePicker />
	</main>
</div>
