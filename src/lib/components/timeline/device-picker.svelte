<script lang="ts">
	import { MagnifyingGlass } from 'phosphor-svelte';
	import { Input } from '$lib/components/ui/input';
	import { list_accounts, list_all_devices } from '$lib/data/bsj.remote';
	import DeviceListSkeleton from './device-list-skeleton.svelte';
	import DevicePickerSections from './device-picker-sections.svelte';
	import TimelineError from './timeline-error.svelte';

	let search = $state('');
</script>

<div class="space-y-5">
	<div class="relative">
		<MagnifyingGlass
			weight="duotone"
			class="text-muted-foreground pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2"
		/>
		<Input
			type="search"
			placeholder="Search by device number, account, or group..."
			bind:value={search}
			class="h-11 pl-9 text-base sm:text-sm"
			aria-label="Filter devices across all accounts"
		/>
	</div>

	<svelte:boundary>
		{#snippet pending()}
			<DeviceListSkeleton />
		{/snippet}

		{#snippet failed(error: unknown, reset: () => void)}
			<TimelineError {error} {reset} />
		{/snippet}

		{@const [accounts, allDevices] = await Promise.all([list_accounts(), list_all_devices()])}

		<DevicePickerSections {accounts} {allDevices} {search} />
	</svelte:boundary>
</div>
