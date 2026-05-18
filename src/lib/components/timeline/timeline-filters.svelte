<script lang="ts">
	import { goto } from '$app/navigation';
	import { navigating, page } from '$app/state';
	import {
		ArrowRight,
		CircleNotch,
		Funnel,
		Image as ImageIcon,
		VideoCamera
	} from 'phosphor-svelte';
	import * as ToggleGroup from '$lib/components/ui/toggle-group';
	import { Button } from '$lib/components/ui/button';
	import { DateTimePicker } from '$lib/components/ui/date-time-picker';

	interface Props {
		/** Canonical UTC ISO 8601 timestamp; the picker treats it as local-time for display. */
		startTime: string;
		/** Canonical UTC ISO 8601 timestamp; the picker treats it as local-time for display. */
		endTime: string;
		multiType: number;
	}

	let { startTime, endTime, multiType }: Props = $props();

	// Writable $derived: re-syncs with URL props after navigation,
	// but local edits before submission are preserved until then.
	// Values are UTC ISO strings — the URL stores them verbatim,
	// `URLSearchParams` encodes the colons/dots as needed.
	let startValue = $derived(startTime);
	let endValue = $derived(endTime);
	let typeValue = $derived(String(multiType));

	// `navigating.to` is non-null while SvelteKit is mid-navigation,
	// which is exactly the window between `goto(...)` and the new page
	// being ready — perfect for surfacing an Apply-button spinner.
	let isApplying = $derived(!!navigating.to);

	function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		// Build the destination off the live page URL so we keep the
		// origin/path and only swap the search params. Passing a `URL`
		// object to `goto` is preferred (over a string) — it side-steps
		// the typed-route lint on dynamic pathnames and is what SvelteKit
		// normalises internally anyway.
		const url = new URL(page.url);
		url.search = '';
		if (startValue) url.searchParams.set('start', startValue);
		if (endValue) url.searchParams.set('end', endValue);
		if (typeValue) url.searchParams.set('type', typeValue);
		goto(url, { keepFocus: true });
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

	<Button
		type="submit"
		disabled={isApplying}
		class="w-full gap-1.5 sm:ml-auto sm:w-auto"
	>
		{#if isApplying}
			<CircleNotch weight="bold" class="animate-spin" />
			Applying
		{:else}
			<Funnel weight="duotone" />
			Apply
		{/if}
	</Button>
</form>
