<script lang="ts">
	import {
		ArrowLeft,
		Calendar,
		CaretRight,
		Image as ImageIcon,
		Printer,
		VideoCamera,
	} from 'phosphor-svelte';
	import { page } from '$app/state';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import UserMenu from '$lib/components/user-menu.svelte';

	interface Props {
		deviceName: string;
		startTime: string;
		endTime: string;
		total: number;
		multiType: number;
		/** Show the Print button. Defaults to `false` so the header is reusable in skeleton-only mounts. */
		canPrint?: boolean;
		/** Called when the user clicks Print. Required when `canPrint` is true. */
		onPrint?: () => void;
	}

	let {
		deviceName,
		startTime,
		endTime,
		total,
		multiType,
		canPrint = false,
		onPrint,
	}: Props = $props();

	const dateRange = $derived(`${startTime.slice(0, 10)} → ${endTime.slice(0, 10)}`);
	const typeLabel = $derived(multiType === 0 ? 'Pictures' : 'Videos');
	const userName = $derived(page.data.userName as string | null);
</script>

<header class="border-b bg-background/95 sticky top-0 z-10 backdrop-blur-sm">
	<div class="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-5 sm:px-6 lg:px-8">
		<div class="flex items-center justify-between gap-3">
			<nav
				aria-label="Breadcrumb"
				class="text-muted-foreground flex min-w-0 items-center gap-2 text-sm"
			>
				<Button
					href="/timeline"
					variant="ghost"
					size="sm"
					class="text-muted-foreground hover:text-foreground -ml-2 gap-1.5"
				>
					<ArrowLeft />
					Change device
				</Button>
				<CaretRight class="text-muted-foreground/50 size-3.5" />
				<a
					href="/timeline"
					class="hover:text-foreground transition-colors"
				>
					Timeline
				</a>
				<CaretRight class="text-muted-foreground/50 size-3.5" />
				<span class="text-foreground max-w-xs truncate font-medium">{deviceName}</span>
			</nav>
			{#if userName}
				<UserMenu {userName} />
			{/if}
		</div>

		<div class="flex flex-wrap items-end justify-between gap-3">
			<div class="min-w-0 space-y-1.5">
				<h1 class="text-foreground truncate text-xl font-semibold tracking-tight sm:text-2xl">
					{deviceName}
				</h1>
				<p class="text-muted-foreground text-sm">
					Snapshots captured by this device during the selected range.
				</p>
			</div>

			<div class="flex flex-wrap items-center gap-1.5">
				<Badge variant="secondary" class="gap-1">
					<Calendar />
					<span class="font-mono tabular-nums">{dateRange}</span>
				</Badge>
				<Badge variant="outline" class="gap-1">
					{#if multiType === 0}
						<ImageIcon />
					{:else}
						<VideoCamera />
					{/if}
					{typeLabel}
				</Badge>
				<Badge class="tabular-nums">
					{total} snapshot{total === 1 ? '' : 's'}
				</Badge>
				{#if canPrint && onPrint}
					<Button
						type="button"
						variant="outline"
						class="ml-1 gap-1.5"
						onclick={onPrint}
					>
						<Printer weight="duotone" />
						Print
					</Button>
				{/if}
			</div>
		</div>
	</div>
</header>
