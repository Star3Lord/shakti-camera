<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { ArrowRight, Funnel, Image as ImageIcon, VideoCamera } from 'phosphor-svelte';
	import * as ToggleGroup from '$lib/components/ui/toggle-group';
	import { Button } from '$lib/components/ui/button';
	import { DateTimePicker } from '$lib/components/ui/date-time-picker';

	interface Props {
		startTime: string;
		endTime: string;
		multiType: number;
	}

	let { startTime, endTime, multiType }: Props = $props();

	// Writable $derived: re-syncs with URL props after navigation,
	// but local edits before submission are preserved until then.
	let startValue = $derived(startTime);
	let endValue = $derived(endTime);
	let typeValue = $derived(String(multiType));

	function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		const params = new URLSearchParams();
		if (startValue) params.set('start', startValue);
		if (endValue) params.set('end', endValue);
		if (typeValue) params.set('type', typeValue);
		goto(`${page.url.pathname}?${params.toString()}`, { keepFocus: true });
	}

	// ToggleGroup with type="single" emits "" when the active item is
	// clicked to deselect. Fall back to "0" (Picture) so the type
	// always has a meaningful value.
	function handleTypeChange(next: string) {
		typeValue = next || '0';
	}
</script>

<form
	onsubmit={handleSubmit}
	class="border-border mb-6 flex flex-wrap items-center gap-3 border-b pb-4"
>
	<ToggleGroup.Root
		type="single"
		variant="outline"
		value={typeValue}
		onValueChange={handleTypeChange}
		aria-label="Snapshot type"
		class="w-full sm:w-auto"
	>
		<ToggleGroup.Item value="0" aria-label="Picture" class="flex-1 gap-1.5 sm:flex-none">
			<ImageIcon weight="duotone" />
			Picture
		</ToggleGroup.Item>
		<ToggleGroup.Item value="1" aria-label="Video" class="flex-1 gap-1.5 sm:flex-none">
			<VideoCamera weight="duotone" />
			Video
		</ToggleGroup.Item>
	</ToggleGroup.Root>

	<div class="flex w-full min-w-0 flex-1 items-center gap-2 sm:w-auto">
		<DateTimePicker
			label="Start"
			value={startValue}
			onChange={(v) => (startValue = v)}
		/>
		<ArrowRight class="text-muted-foreground size-4 shrink-0" weight="bold" />
		<DateTimePicker label="End" value={endValue} onChange={(v) => (endValue = v)} />
	</div>

	<Button type="submit" class="w-full gap-1.5 sm:ml-auto sm:w-auto">
		<Funnel weight="duotone" />
		Apply
	</Button>
</form>
