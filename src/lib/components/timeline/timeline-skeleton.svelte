<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { Separator } from '$lib/components/ui/separator';

	interface Props {
		count?: number;
	}

	let { count = 6 }: Props = $props();
</script>

<section
	class="space-y-6"
	aria-busy="true"
	aria-live="polite"
	aria-label="Loading snapshots"
>
	<Card.Root>
		<Card.Header class="border-b pb-4">
			<Skeleton class="h-3.5 w-32" />
		</Card.Header>
		<Card.Content>
			<div class="grid gap-4 sm:grid-cols-2 md:grid-cols-[1fr_1fr_auto_auto] md:items-end">
				<div class="space-y-1.5">
					<Skeleton class="h-2.5 w-12" />
					<Skeleton class="h-8 w-full" />
				</div>
				<div class="space-y-1.5">
					<Skeleton class="h-2.5 w-12" />
					<Skeleton class="h-8 w-full" />
				</div>
				<div class="space-y-1.5">
					<Skeleton class="h-2.5 w-12" />
					<Skeleton class="h-8 w-32" />
				</div>
				<Skeleton class="h-8 w-20" />
			</div>
		</Card.Content>
	</Card.Root>

	<div class="space-y-4">
		<div class="text-muted-foreground flex items-center gap-3 text-xs font-medium">
			<Skeleton class="h-3 w-28" />
			<Separator class="flex-1" />
		</div>

		<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
			{#each { length: count }, i (i)}
				<Card.Root>
					<Skeleton class="aspect-video w-full rounded-none" />
					<Card.Content class="space-y-2.5 pt-3">
						<div class="flex items-center gap-2">
							<Skeleton class="size-3.5 rounded-full" />
							<Skeleton class="h-3 w-24" />
							<Skeleton class="ml-auto h-3 w-12" />
						</div>
						<div class="flex items-start gap-2">
							<Skeleton class="mt-0.5 size-3.5 rounded-full" />
							<div class="flex-1 space-y-1.5">
								<Skeleton class="h-2.5 w-full" />
								<Skeleton class="h-2.5 w-4/5" />
							</div>
						</div>
					</Card.Content>
					<Card.Footer class="border-t pt-3">
						<Skeleton class="h-3 w-32" />
						<Skeleton class="ml-auto h-5 w-16" />
					</Card.Footer>
				</Card.Root>
			{/each}
		</div>
	</div>
</section>
