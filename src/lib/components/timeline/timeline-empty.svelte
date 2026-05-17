<script lang="ts">
	import { ImageSquare, VideoCamera } from 'phosphor-svelte';
	import * as Card from '$lib/components/ui/card';

	interface Props {
		multiType: number;
		deviceName: string;
	}

	let { multiType, deviceName }: Props = $props();

	const typeLabel = $derived(multiType === 0 ? 'pictures' : 'videos');
</script>

<Card.Root class="mx-auto w-full max-w-md">
	<Card.Content class="flex flex-col items-center gap-4 px-6 py-12 text-center">
		<div class="bg-muted text-muted-foreground flex size-14 items-center justify-center rounded-full">
			{#if multiType === 0}
				<ImageSquare class="size-7" weight="duotone" />
			{:else}
				<VideoCamera class="size-7" weight="duotone" />
			{/if}
		</div>
		<div class="space-y-1.5">
			<h2 class="text-foreground text-base font-medium">No snapshots found</h2>
			<p class="text-muted-foreground text-sm leading-relaxed">
				No {typeLabel} were captured by
				<span class="text-foreground font-medium">{deviceName}</span>
				in the selected time range. Adjust the date range or switch the media type above to try again.
			</p>
		</div>
	</Card.Content>
</Card.Root>
