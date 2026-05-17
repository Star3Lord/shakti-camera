<script lang="ts">
	import { Skeleton } from '$lib/components/ui/skeleton';

	interface Props {
		count?: number;
	}

	let { count = 8 }: Props = $props();
</script>

<section
	class="grid grid-cols-1 gap-2 sm:grid-cols-2"
	aria-busy="true"
	aria-live="polite"
	aria-label="Loading devices"
>
	{#each { length: count }, i (i)}
		<div
			class="ring-border bg-card flex items-center gap-3 rounded-lg px-3.5 py-3 ring-1"
		>
			<Skeleton class="size-10 shrink-0 rounded-lg" />
			<div class="min-w-0 flex-1 space-y-2">
				<Skeleton class="h-3.5 w-32" />
				<Skeleton class="h-3 w-20" />
			</div>
			<Skeleton class="size-4 shrink-0 rounded-sm" />
		</div>
	{/each}
</section>
