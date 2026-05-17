<script lang="ts">
	import { onMount } from "svelte";
	import {
		CalendarDateTime,
		type DateValue,
		parseDateTime,
	} from "@internationalized/date";
	import { CalendarBlank } from "phosphor-svelte";
	import { Button } from "$lib/components/ui/button";
	import * as Popover from "$lib/components/ui/popover";
	import { Calendar } from "$lib/components/ui/calendar";
	import { cn } from "$lib/utils.js";

	interface Props {
		value: string | undefined;
		onChange: (value: string) => void;
		label?: string;
		id?: string;
		class?: string;
	}

	let {
		value,
		onChange,
		label = "Pick a date",
		id,
		class: className,
	}: Props = $props();

	const uid = $props.id();
	const timeInputId = `${uid}-time`;

	let mounted = $state(false);
	let open = $state(false);

	onMount(() => {
		mounted = true;
	});

	function pad(n: number): string {
		return String(n).padStart(2, "0");
	}

	function toBSJ(dt: CalendarDateTime): string {
		return `${dt.year}-${pad(dt.month)}-${pad(dt.day)} ${pad(dt.hour)}:${pad(dt.minute)}:${pad(dt.second)}`;
	}

	function tryParse(raw: string | undefined): CalendarDateTime | undefined {
		if (!raw) return undefined;
		try {
			return parseDateTime(raw.replace(" ", "T"));
		} catch {
			return undefined;
		}
	}

	const current = $derived(tryParse(value));

	const triggerLabel = $derived.by(() => {
		if (!current) return label;
		if (!mounted) {
			// SSR-stable: locale-independent fallback before hydration completes
			return toBSJ(current).slice(0, 16);
		}
		const d = new Date(
			current.year,
			current.month - 1,
			current.day,
			current.hour,
			current.minute,
			current.second,
		);
		const datePart = d.toLocaleDateString(undefined, {
			month: "short",
			day: "numeric",
			year: "numeric",
		});
		const timePart = d
			.toLocaleTimeString(undefined, {
				hour: "numeric",
				minute: "2-digit",
				hour12: true,
			})
			.toLowerCase();
		return `${datePart} ${timePart}`;
	});

	const timeString = $derived(
		current ? `${pad(current.hour)}:${pad(current.minute)}` : "",
	);

	function handleDateChange(next: DateValue | undefined) {
		if (!next) return;
		const merged = new CalendarDateTime(
			next.year,
			next.month,
			next.day,
			current?.hour ?? 0,
			current?.minute ?? 0,
			current?.second ?? 0,
		);
		onChange(toBSJ(merged));
	}

	function handleTimeChange(event: Event & { currentTarget: HTMLInputElement }) {
		const raw = event.currentTarget.value;
		if (!raw) return;
		const [hh, mm] = raw.split(":").map(Number);
		const now = new Date();
		const base =
			current ??
			new CalendarDateTime(now.getFullYear(), now.getMonth() + 1, now.getDate());
		const merged = new CalendarDateTime(
			base.year,
			base.month,
			base.day,
			Number.isFinite(hh) ? hh : 0,
			Number.isFinite(mm) ? mm : 0,
			0,
		);
		onChange(toBSJ(merged));
	}
</script>

<Popover.Root bind:open>
	<Popover.Trigger>
		{#snippet child({ props })}
			<Button
				{id}
				variant="outline"
				aria-label={label}
				class={cn(
					"w-full justify-start gap-2 px-2.5 text-left font-normal",
					!current && "text-muted-foreground",
					className,
				)}
				{...props}
			>
				<CalendarBlank weight="duotone" />
				<span class="truncate">{triggerLabel}</span>
			</Button>
		{/snippet}
	</Popover.Trigger>
	<Popover.Content class="w-auto gap-0 p-0" align="start">
		<Calendar type="single" value={current} onValueChange={handleDateChange} />
		<div class="border-t px-6 py-3">
			<label
				for={timeInputId}
				class="text-muted-foreground mb-2 block text-xs font-medium uppercase tracking-wide"
			>
				Time
			</label>
			<input
				id={timeInputId}
				type="time"
				value={timeString}
				onchange={handleTimeChange}
				step="60"
				data-slot="input"
				class="bg-input/20 dark:bg-input/30 border-input focus-visible:border-ring focus-visible:ring-ring/50 text-foreground placeholder:text-muted-foreground h-8 w-full rounded-lg border px-2.5 py-1 text-sm transition-colors outline-none focus-visible:ring-3 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50"
			/>
		</div>
	</Popover.Content>
</Popover.Root>
