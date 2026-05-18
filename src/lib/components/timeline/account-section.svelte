<script lang="ts">
	import { CaretRight, FolderSimple, MagnifyingGlass, User } from 'phosphor-svelte';
	import { Badge } from '$lib/components/ui/badge';
	import type { BSJAccount, BSJDevice } from '$lib/bsj';
	import DeviceRow from './device-row.svelte';

	interface Props {
		account: BSJAccount;
		/** Devices already filtered to this account + matching the search query. */
		devices: BSJDevice[];
		/** Total devices in this account before search filtering — used for the count badge so the user knows the section's underlying size even while typing. */
		totalCount: number;
		searching: boolean;
	}

	let { account, devices, totalCount, searching }: Props = $props();

	/**
	 * Cluster the (already-filtered) devices by their BSJ group within this
	 * account, preserving first-seen order so the visual layout matches the
	 * order the API returned them in. Each entry becomes a labelled subgrid
	 * under the account header.
	 */
	const grouped = $derived.by(() => {
		const out: Array<{ groupName: string; items: BSJDevice[] }> = [];
		const indexByGroup: Record<string, number> = {};
		for (const d of devices) {
			const key = d.groupName ?? 'Ungrouped';
			const existing = indexByGroup[key];
			if (existing === undefined) {
				indexByGroup[key] = out.length;
				out.push({ groupName: key, items: [d] });
			} else {
				out[existing].items.push(d);
			}
		}
		return out;
	});
</script>

<section
	class="border-border/60 bg-card/30 rounded-xl border p-4 sm:p-5"
	aria-labelledby="account-{account.id}-heading"
>
	<header class="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
		<div class="min-w-0 space-y-1.5">
			{#if account.ancestors.length > 0}
				<nav
					class="text-muted-foreground flex flex-wrap items-center gap-1 text-xs"
					aria-label="Account path"
				>
					{#each account.ancestors as ancestor, i (i)}
						{#if i > 0}
							<CaretRight class="size-3 shrink-0 opacity-60" weight="bold" />
						{/if}
						<span class="truncate">{ancestor}</span>
					{/each}
				</nav>
			{/if}
			<div class="flex items-center gap-2">
				<span
					class="bg-muted text-muted-foreground flex size-7 shrink-0 items-center justify-center rounded-md"
				>
					<User weight="duotone" class="size-4" />
				</span>
				<h2
					id="account-{account.id}-heading"
					class="text-foreground truncate text-base font-semibold tracking-tight"
				>
					{account.userName}
				</h2>
				<Badge variant="secondary" class="ml-1 font-normal tabular-nums">
					{#if searching && devices.length !== totalCount}
						{devices.length} / {totalCount}
					{:else}
						{totalCount}
					{/if}
				</Badge>
			</div>
		</div>
	</header>

	{#if devices.length === 0}
		<div
			class="text-muted-foreground flex items-center justify-center gap-2 rounded-lg border border-dashed py-6 text-xs"
		>
			<MagnifyingGlass weight="duotone" class="size-3.5" />
			<span>
				{#if totalCount === 0}
					No devices in this account
				{:else}
					No matches in this account
				{/if}
			</span>
		</div>
	{:else}
		<div class="space-y-4">
			{#each grouped as { groupName, items } (groupName)}
				<div class="space-y-2">
					{#if grouped.length > 1 || groupName !== 'Ungrouped'}
						<h3
							class="text-muted-foreground flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider"
						>
							<FolderSimple weight="duotone" class="size-3.5" />
							{groupName}
						</h3>
					{/if}
					<div class="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
						{#each items as device (device.vehicleId)}
							<DeviceRow {device} />
						{/each}
					</div>
				</div>
			{/each}
		</div>
	{/if}
</section>
