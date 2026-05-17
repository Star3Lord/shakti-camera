<script lang="ts">
	import { MagnifyingGlass } from 'phosphor-svelte';
	import { page } from '$app/state';
	import {
		DeviceList,
		DeviceListSkeleton,
		TimelineError,
	} from '$lib/components/timeline';
	import { Input } from '$lib/components/ui/input';
	import UserMenu from '$lib/components/user-menu.svelte';
	import { list_devices } from '$lib/data/bsj.remote';

	let search = $state('');
	const userName = $derived(page.data.userName as string | null);
</script>

<svelte:head>
	<title>Devices · Monitoring</title>
</svelte:head>

<div class="bg-background text-foreground min-h-screen">
	<header class="border-b">
		<div class="mx-auto flex max-w-6xl items-start justify-between gap-3 px-4 py-5 sm:px-6 lg:px-8">
			<div class="min-w-0 space-y-1.5">
				<h1 class="text-foreground text-xl font-semibold tracking-tight sm:text-2xl">
					Timeline
				</h1>
				<p class="text-muted-foreground text-sm">
					Select a device to view its snapshot timeline.
				</p>
			</div>
			{#if userName}
				<UserMenu {userName} />
			{/if}
		</div>
	</header>

	<main class="mx-auto max-w-6xl space-y-5 px-4 py-6 sm:px-6 lg:px-8">
		<div class="relative">
			<MagnifyingGlass
				weight="duotone"
				class="text-muted-foreground pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2"
			/>
			<Input
				type="search"
				placeholder="Search by device number, label, or group..."
				bind:value={search}
				class="pl-8"
				aria-label="Filter devices"
			/>
		</div>

		<svelte:boundary>
			{#snippet pending()}
				<DeviceListSkeleton />
			{/snippet}

			{#snippet failed(error: unknown, reset: () => void)}
				<TimelineError {error} {reset} />
			{/snippet}

			{@const devices = await list_devices()}

			<DeviceList {devices} {search} />
		</svelte:boundary>
	</main>
</div>
