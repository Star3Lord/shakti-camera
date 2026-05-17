<script lang="ts">
	import {
		ArrowSquareOut,
		Clock,
		DownloadSimple,
		Image as ImageIcon,
		MapPin,
		VideoCamera,
	} from 'phosphor-svelte';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import * as Tooltip from '$lib/components/ui/tooltip';
	import type { EnrichedSnapshot } from '$lib/bsj';

	interface Props {
		snap: EnrichedSnapshot;
		mounted: boolean;
		tzLabel: string;
	}

	let { snap, mounted, tzLabel }: Props = $props();

	function formatTime(iso: string): string {
		if (!mounted) return new Date(iso).toISOString().slice(11, 16) + ' UTC';
		return new Date(iso)
			.toLocaleTimeString(undefined, {
				hour: 'numeric',
				minute: '2-digit',
				hour12: true,
			})
			.toLowerCase();
	}

	function ordinalSuffix(day: number): string {
		const k = day % 100;
		if (k >= 11 && k <= 13) return 'th';
		const j = day % 10;
		if (j === 1) return 'st';
		if (j === 2) return 'nd';
		if (j === 3) return 'rd';
		return 'th';
	}

	function formatFullDateTime(
		iso: string,
		isMounted: boolean,
		opts: { timeZone?: 'UTC' | undefined } = {},
	): string {
		const useUtc = opts.timeZone === 'UTC';
		if (!isMounted && !useUtc) {
			return new Date(iso).toISOString().slice(0, 19).replace('T', ' ') + ' UTC';
		}
		const d = new Date(iso);
		const locale = useUtc ? 'en-US' : undefined;
		const tzOpt: Intl.DateTimeFormatOptions = useUtc ? { timeZone: 'UTC' } : {};
		const time = d.toLocaleTimeString(locale, {
			hour: 'numeric',
			minute: '2-digit',
			hour12: true,
			...tzOpt,
		});
		const dayStr = new Intl.DateTimeFormat('en-US', {
			day: 'numeric',
			...tzOpt,
		}).format(d);
		const day = parseInt(dayStr, 10);
		const parts = new Intl.DateTimeFormat(locale, {
			month: 'long',
			year: 'numeric',
			...tzOpt,
		}).formatToParts(d);
		const month = parts.find((p) => p.type === 'month')?.value ?? '';
		const year = parts.find((p) => p.type === 'year')?.value ?? '';
		return `${time}, ${day}${ordinalSuffix(day)} ${month}, ${year}`;
	}

	function getLocalTimezoneAbbr(date: Date, isMounted: boolean): string {
		if (!isMounted) return 'UTC';
		try {
			const parts = new Intl.DateTimeFormat(undefined, {
				timeZoneName: 'short',
			}).formatToParts(date);
			return parts.find((p) => p.type === 'timeZoneName')?.value ?? 'UTC';
		} catch {
			return 'UTC';
		}
	}

	function formatCoord(lat: number, lon: number): string {
		const ns = lat >= 0 ? 'N' : 'S';
		const ew = lon >= 0 ? 'E' : 'W';
		return `${Math.abs(lat).toFixed(4)}°${ns}, ${Math.abs(lon).toFixed(4)}°${ew}`;
	}

	const utcFormatted = $derived(
		formatFullDateTime(snap.operatorTime, mounted, { timeZone: 'UTC' }),
	);
	const localFormatted = $derived(formatFullDateTime(snap.operatorTime, mounted));
	const localTzAbbr = $derived(getLocalTimezoneAbbr(new Date(snap.operatorTime), mounted));
	const showLocalRow = $derived(mounted && localTzAbbr !== 'UTC');
</script>

<Card.Root
	class="ring-border hover:ring-foreground/20 hover:shadow-md group/snapshot transition-all duration-200 hover:-translate-y-0.5"
>
	<div class="bg-muted relative aspect-video w-full overflow-hidden">
		<img
			src={snap.imageUrl}
			alt="Channel {snap.channel} snapshot at {snap.operatorTime}"
			class="absolute inset-0 size-full object-cover transition-transform duration-300 group-hover/snapshot:scale-[1.03]"
			loading="lazy"
		/>
		<div class="absolute inset-x-2 top-2 flex items-center justify-between gap-2">
			<Badge class="bg-background/85 text-foreground border-border/60 ring-foreground/5 backdrop-blur-sm">
				Ch {snap.channel}
			</Badge>
			<Badge class="bg-background/85 text-foreground border-border/60 ring-foreground/5 gap-1 backdrop-blur-sm">
				{#if snap.multiType === 0}
					<ImageIcon />
					Picture
				{:else}
					<VideoCamera />
					Video
				{/if}
			</Badge>
		</div>
	</div>

	<Card.Content class="space-y-2.5 pt-3.5">
		<div class="flex items-center gap-2">
			<Clock class="text-muted-foreground size-4 shrink-0" weight="duotone" />
			<Tooltip.Root>
				<Tooltip.Trigger
					class="text-foreground cursor-help font-mono text-sm font-medium tabular-nums"
				>
					{formatTime(snap.operatorTime)}
				</Tooltip.Trigger>
				<Tooltip.Content side="top" class="p-3">
					<div class="grid grid-cols-[auto_1fr] items-center gap-x-2.5 gap-y-1.5">
						<Badge
							variant="secondary"
							class="bg-background/15 text-background min-w-12 font-mono"
						>
							UTC
						</Badge>
						<span class="font-mono tabular-nums">{utcFormatted}</span>
						{#if showLocalRow}
							<Badge
								variant="outline"
								class="border-background/30 text-background min-w-12 bg-transparent font-mono"
							>
								{localTzAbbr}
							</Badge>
							<span class="font-mono tabular-nums">{localFormatted}</span>
						{/if}
					</div>
				</Tooltip.Content>
			</Tooltip.Root>
			<Badge variant="outline" class="border-border/60 ml-auto font-mono">
				{tzLabel}
			</Badge>
		</div>

		<div class="flex items-start gap-2">
			<MapPin class="text-muted-foreground mt-0.5 size-4 shrink-0" weight="duotone" />
			<Tooltip.Root>
				<Tooltip.Trigger
					class="text-muted-foreground hover:text-foreground line-clamp-2 cursor-help text-left text-sm leading-snug transition-colors"
				>
					{snap.address}
				</Tooltip.Trigger>
				<Tooltip.Content side="top" class="max-w-sm">
					<p class="leading-relaxed">{snap.address}</p>
					<p class="text-background/70 mt-1 font-mono text-xs">
						{formatCoord(snap.lat, snap.lon)}
					</p>
				</Tooltip.Content>
			</Tooltip.Root>
		</div>
	</Card.Content>

	<Card.Footer class="border-t pt-3">
		{#if snap.terminalType}
			<Badge variant="secondary">{snap.terminalType}</Badge>
		{/if}
		<div class="ml-auto flex items-center gap-1">
			<Button
				href={snap.mapsUrl}
				target="_blank"
				rel="noopener noreferrer"
				variant="ghost"
				size="sm"
				class="gap-1"
				aria-label="Open in Google Maps"
			>
				<ArrowSquareOut />
				Maps
			</Button>
			<Button
				href={snap.imageUrl}
				download
				variant="ghost"
				size="sm"
				class="gap-1"
				aria-label="Download snapshot"
			>
				<DownloadSimple />
				Save
			</Button>
		</div>
	</Card.Footer>
</Card.Root>
