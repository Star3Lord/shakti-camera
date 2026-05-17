<script lang="ts">
	import { MagnifyingGlass } from 'phosphor-svelte';
	import * as Card from '$lib/components/ui/card';
	import type { BSJDevice } from '$lib/bsj';
	import DeviceRow from './device-row.svelte';

	interface Props {
		devices: BSJDevice[];
		search: string;
	}

	let { devices, search }: Props = $props();

	const filtered = $derived.by(() => {
		const q = search.trim().toLowerCase();
		if (!q) return devices;
		return devices.filter(
			(d) =>
				d.terminalNo.toLowerCase().includes(q) ||
				d.label?.toLowerCase().includes(q) ||
				d.groupName?.toLowerCase().includes(q),
		);
	});
</script>

{#if filtered.length === 0}
	<Card.Root class="mx-auto w-full max-w-md">
		<Card.Content class="flex flex-col items-center gap-4 px-6 py-12 text-center">
			<div class="bg-muted text-muted-foreground flex size-14 items-center justify-center rounded-full">
				<MagnifyingGlass class="size-6" weight="duotone" />
			</div>
			<div class="space-y-1.5">
				<h2 class="text-foreground text-base font-medium">No devices match</h2>
				<p class="text-muted-foreground text-sm leading-relaxed">
					No devices matched
					<span class="text-foreground font-mono">'{search}'</span>. Try a different query.
				</p>
			</div>
		</Card.Content>
	</Card.Root>
{:else}
	<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
		{#each filtered as device (device.vehicleId)}
			<DeviceRow {device} />
		{/each}
	</div>
{/if}
