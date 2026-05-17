<script lang="ts">
	import { CaretRight, DeviceMobile } from 'phosphor-svelte';
	import { Badge } from '$lib/components/ui/badge';
	import type { BSJDevice } from '$lib/bsj';

	interface Props {
		device: BSJDevice;
	}

	let { device }: Props = $props();
</script>

<a
	href="/timeline/{device.terminalNo}"
	data-slot="device-row"
	class="ring-border hover:ring-foreground/20 hover:bg-muted/40 focus-visible:ring-ring focus-visible:outline-ring bg-card text-card-foreground group/device-row flex items-center gap-3 rounded-lg px-3.5 py-3 text-sm ring-1 transition-all outline-none hover:-translate-y-px hover:shadow-sm focus-visible:ring-2 focus-visible:outline-1"
>
	<div class="bg-muted text-muted-foreground group-hover/device-row:bg-background flex size-10 shrink-0 items-center justify-center rounded-lg transition-colors">
		<DeviceMobile weight="duotone" class="size-5" />
	</div>

	<div class="min-w-0 flex-1 space-y-1">
		<div class="text-foreground truncate font-mono text-sm font-medium tabular-nums">
			{device.terminalNo}
		</div>
		<div class="text-muted-foreground flex flex-wrap items-center gap-1.5 text-xs">
			{#if device.groupName}
				<span class="truncate">{device.groupName}</span>
			{/if}
			{#if device.groupName && device.terminalType}
				<span class="text-muted-foreground/40">·</span>
			{/if}
			{#if device.terminalType}
				<Badge variant="outline" class="border-border/60 font-normal tabular-nums">
					{device.terminalType}
				</Badge>
			{/if}
		</div>
	</div>

	<CaretRight
		class="text-muted-foreground/60 group-hover/device-row:text-foreground size-4 shrink-0 transition-all group-hover/device-row:translate-x-0.5"
	/>
</a>
