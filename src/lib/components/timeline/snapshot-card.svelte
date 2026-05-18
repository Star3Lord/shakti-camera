<script lang="ts">
	import {
		Clock,
		DotsThree,
		DownloadSimple,
		Image as ImageIcon,
		MapPin,
		VideoCamera,
	} from 'phosphor-svelte';
	import { Badge } from '$lib/components/ui/badge';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import * as Tooltip from '$lib/components/ui/tooltip';
	import type { EnrichedSnapshot } from '$lib/bsj';

	interface Props {
		snap: EnrichedSnapshot;
		mounted: boolean;
		tzLabel: string;
	}

	let { snap, mounted }: Props = $props();

	function formatTime12h(d: Date, useUtc: boolean): string {
		const h24 = useUtc ? d.getUTCHours() : d.getHours();
		const m = useUtc ? d.getUTCMinutes() : d.getMinutes();
		const s = useUtc ? d.getUTCSeconds() : d.getSeconds();
		const ampm = h24 >= 12 ? 'PM' : 'AM';
		const h12 = h24 % 12 || 12;
		return `${h12}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')} ${ampm}`;
	}

	function formatTime(iso: string): string {
		const d = new Date(iso);
		if (!mounted) {
			const hh = String(d.getUTCHours()).padStart(2, '0');
			const mm = String(d.getUTCMinutes()).padStart(2, '0');
			const ss = String(d.getUTCSeconds()).padStart(2, '0');
			return `${hh}:${mm}:${ss} UTC`;
		}
		return formatTime12h(d, false);
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
		const time = formatTime12h(d, useUtc);
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

	function downloadImage(): void {
		const a = document.createElement('a');
		a.href = snap.imageUrl;
		// Empty value preserves the URL's filename, matching the previous
		// `<a href={snap.imageUrl} download>` behaviour.
		a.download = '';
		a.rel = 'noopener';
		document.body.appendChild(a);
		a.click();
		a.remove();
	}

	function openInMaps(): void {
		window.open(snap.mapsUrl, '_blank', 'noopener,noreferrer');
	}

	const utcFormatted = $derived(
		formatFullDateTime(snap.operatorTime, mounted, { timeZone: 'UTC' }),
	);
	const localFormatted = $derived(formatFullDateTime(snap.operatorTime, mounted));
	const localTzAbbr = $derived(getLocalTimezoneAbbr(new Date(snap.operatorTime), mounted));
	const showLocalRow = $derived(mounted && localTzAbbr !== 'UTC');
</script>

<article class="group/snapshot">
	<div
		class="bg-muted ring-border/40 group-hover/snapshot:ring-foreground/30 group-hover/snapshot:shadow-md relative aspect-video w-full overflow-hidden rounded-xl ring-1 transition-all duration-200"
	>
		<img
			src={snap.imageUrl}
			alt="Channel {snap.channel} snapshot at {snap.operatorTime}"
			class="absolute inset-0 size-full object-cover transition-transform duration-300 group-hover/snapshot:scale-[1.02]"
			loading="lazy"
		/>

		<Badge
			class="bg-background/85 text-foreground border-border/60 ring-foreground/5 absolute left-2 top-2 backdrop-blur-sm"
		>
			Ch {snap.channel}
		</Badge>

		<DropdownMenu.Root>
			<DropdownMenu.Trigger
				class="bg-background/85 text-foreground hover:bg-background border-border/60 ring-foreground/5 focus-visible:ring-ring absolute right-2 top-2 inline-flex size-7 items-center justify-center rounded-full border ring-1 backdrop-blur-sm transition-colors focus-visible:outline-none focus-visible:ring-2"
				aria-label="Snapshot actions"
			>
				<DotsThree class="size-4" weight="bold" />
			</DropdownMenu.Trigger>
			<DropdownMenu.Content align="end" sideOffset={6} class="min-w-44">
				<DropdownMenu.Item onSelect={downloadImage}>
					<DownloadSimple weight="duotone" />
					Download image
				</DropdownMenu.Item>
				<DropdownMenu.Item onSelect={openInMaps}>
					<MapPin weight="duotone" />
					Open in Maps
				</DropdownMenu.Item>
			</DropdownMenu.Content>
		</DropdownMenu.Root>

		{#if snap.terminalType}
			<Badge
				class="bg-background/85 text-foreground border-border/60 ring-foreground/5 absolute bottom-2 left-2 font-mono backdrop-blur-sm"
			>
				{snap.terminalType}
			</Badge>
		{/if}

		<Badge
			class="bg-background/85 text-foreground border-border/60 ring-foreground/5 absolute bottom-2 right-2 gap-1 backdrop-blur-sm"
		>
			{#if snap.multiType === 0}
				<ImageIcon />
				Picture
			{:else}
				<VideoCamera />
				Video
			{/if}
		</Badge>
	</div>

	<div class="mt-3 space-y-2">
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
	</div>
</article>
