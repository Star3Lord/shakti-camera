<script lang="ts">
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import {
		PrintDialog,
		SnapshotGrid,
		TimelineEmpty,
		TimelineError,
		TimelineFilters,
		TimelineHeader,
		TimelineSkeleton,
	} from '$lib/components/timeline';
	import { get_timeline } from '$lib/data/bsj.remote';
	import { yesterdayRange } from '$lib/bsj';

	const defaults = yesterdayRange();
	const deviceId = $derived(page.params.deviceId ?? '');
	const startTime = $derived(page.url.searchParams.get('start') ?? defaults.start);
	const endTime = $derived(page.url.searchParams.get('end') ?? defaults.end);
	const multiType = $derived(Number(page.url.searchParams.get('type') ?? '0'));

	let mounted = $state(false);
	onMount(() => {
		mounted = true;
	});

	const tzLabel = $derived(
		mounted
			? (Intl.DateTimeFormat().resolvedOptions().timeZone.split('/').pop()?.replace('_', ' ') ?? 'Local')
			: 'UTC',
	);

	let printOpen = $state(false);
</script>

<svelte:head>
	<title>Timeline</title>
</svelte:head>

<div class="bg-background text-foreground min-h-screen">
	<svelte:boundary>
		{#snippet pending()}
			<header class="border-b">
				<div class="mx-auto max-w-6xl space-y-3 px-4 py-5 sm:px-6 lg:px-8">
					<div class="bg-muted h-3.5 w-32 animate-pulse rounded"></div>
					<div class="bg-muted h-6 w-56 animate-pulse rounded"></div>
				</div>
			</header>
			<main class="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
				<TimelineSkeleton />
			</main>
		{/snippet}

		{#snippet failed(error: unknown, reset: () => void)}
			<main class="mx-auto flex max-w-6xl flex-col items-center justify-center px-4 py-16 sm:px-6 lg:px-8">
				<TimelineError {error} {reset} />
			</main>
		{/snippet}

		{@const result = await get_timeline({
			device_id: deviceId,
			start_time: startTime,
			end_time: endTime,
			multi_type: multiType,
		})}

		<TimelineHeader
			deviceName={result.deviceName}
			startTime={result.startTime}
			endTime={result.endTime}
			total={result.snapshots.length}
			multiType={result.multiType}
			canPrint={result.snapshots.length > 0}
			onPrint={() => (printOpen = true)}
		/>

		<main class="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
			<TimelineFilters
				startTime={result.startTime}
				endTime={result.endTime}
				multiType={result.multiType}
			/>

			{#if result.snapshots.length === 0}
				<TimelineEmpty multiType={result.multiType} deviceName={result.deviceName} />
			{:else}
				<SnapshotGrid snapshots={result.snapshots} {mounted} {tzLabel} />
				<PrintDialog
					bind:open={printOpen}
					deviceId={deviceId}
					startTime={result.startTime}
					endTime={result.endTime}
					multiType={result.multiType}
				/>
			{/if}
		</main>
	</svelte:boundary>
</div>
