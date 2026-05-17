<script lang="ts">
	import { Separator } from '$lib/components/ui/separator';
	import { Badge } from '$lib/components/ui/badge';
	import * as Tooltip from '$lib/components/ui/tooltip';
	import type { EnrichedSnapshot } from '$lib/bsj';
	import SnapshotCard from './snapshot-card.svelte';

	interface Props {
		snapshots: EnrichedSnapshot[];
		mounted: boolean;
		tzLabel: string;
	}

	let { snapshots, mounted, tzLabel }: Props = $props();

	function groupKey(iso: string): string {
		return mounted
			? new Date(iso).toLocaleDateString(undefined, {
					weekday: 'long',
					year: 'numeric',
					month: 'long',
					day: 'numeric',
				})
			: new Date(iso).toISOString().slice(0, 10);
	}

	const groups = $derived.by(() => {
		const order: string[] = [];
		const buckets: Record<string, EnrichedSnapshot[]> = {};
		for (const snap of snapshots) {
			const key = groupKey(snap.operatorTime);
			if (buckets[key]) {
				buckets[key].push(snap);
			} else {
				buckets[key] = [snap];
				order.push(key);
			}
		}
		return order.map((key) => [key, buckets[key]] as const);
	});
</script>

<Tooltip.Provider delayDuration={300}>
	<div class="space-y-10">
		{#each groups as [date, snaps] (date)}
			<section class="space-y-4">
				<header class="text-muted-foreground flex items-center gap-3 text-sm font-medium">
					<span class="text-foreground/80">{date}</span>
					<Badge variant="outline" class="tabular-nums">
						{snaps.length}
					</Badge>
					<Separator class="flex-1" />
				</header>

				<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{#each snaps as snap (snap.operatorTime + snap.channel + snap.filePath)}
						<SnapshotCard {snap} {mounted} {tzLabel} />
					{/each}
				</div>
			</section>
		{/each}
	</div>
</Tooltip.Provider>
