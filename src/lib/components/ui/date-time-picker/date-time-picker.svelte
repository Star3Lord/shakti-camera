<script lang="ts">
	import { onMount } from "svelte";
	import {
		CalendarDateTime,
		type DateValue,
	} from "@internationalized/date";
	import { CalendarBlank } from "phosphor-svelte";
	import { Button } from "$lib/components/ui/button";
	import * as Popover from "$lib/components/ui/popover";
	import { Calendar } from "$lib/components/ui/calendar";
	import { cn } from "$lib/utils.js";

	interface Props {
		/**
		 * Canonical UTC ISO 8601 timestamp (e.g. `"2026-05-15T18:30:00.000Z"`).
		 * `undefined` renders the empty / placeholder state.
		 */
		value: string | undefined;
		/**
		 * Emits the user-picked instant as a UTC ISO string. The picker treats
		 * calendar + time selections as the user's local wall-clock and
		 * converts to UTC via `Date#toISOString()` before calling back.
		 */
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

	/**
	 * Parse the incoming ISO into a `Date` so we can read its local-time
	 * components (year / month / day / hour / minute / second) for the
	 * calendar and time input. Returns `undefined` for malformed input.
	 */
	const parsedDate = $derived.by<Date | undefined>(() => {
		if (!value) return undefined;
		const d = new Date(value);
		return isNaN(d.getTime()) ? undefined : d;
	});

	/**
	 * `CalendarDateTime` is timezone-naive — we feed it the user's local
	 * components so the calendar highlights the correct day and the time
	 * input shows the correct HH:MM. Only consumed inside the popover
	 * (rendered post-mount), so the server-vs-client local-time difference
	 * never reaches SSR output.
	 */
	const current = $derived.by<CalendarDateTime | undefined>(() => {
		const d = parsedDate;
		if (!d) return undefined;
		return new CalendarDateTime(
			d.getFullYear(),
			d.getMonth() + 1,
			d.getDate(),
			d.getHours(),
			d.getMinutes(),
			d.getSeconds(),
		);
	});

	function formatTime12hLocal(d: Date): string {
		const h24 = d.getHours();
		const m = d.getMinutes();
		const s = d.getSeconds();
		const ampm = h24 >= 12 ? "PM" : "AM";
		const h12 = h24 % 12 || 12;
		return `${h12}:${pad(m)}:${pad(s)} ${ampm}`;
	}

	function formatTime12hUtc(d: Date): string {
		const h24 = d.getUTCHours();
		const m = d.getUTCMinutes();
		const s = d.getUTCSeconds();
		const ampm = h24 >= 12 ? "PM" : "AM";
		const h12 = h24 % 12 || 12;
		return `${h12}:${pad(m)}:${pad(s)} ${ampm}`;
	}

	const triggerLabel = $derived.by(() => {
		const d = parsedDate;
		if (!d) return label;
		// SSR + pre-hydration: render a deterministic UTC label so the
		// server-rendered HTML matches the initial client render. The
		// effect below swaps to local time once mounted, after hydration.
		if (!mounted) {
			const datePart = new Intl.DateTimeFormat("en-US", {
				month: "short",
				day: "numeric",
				year: "numeric",
				timeZone: "UTC",
			}).format(d);
			return `${datePart} ${formatTime12hUtc(d)}`;
		}
		const datePart = d.toLocaleDateString(undefined, {
			month: "short",
			day: "numeric",
			year: "numeric",
		});
		return `${datePart} ${formatTime12hLocal(d)}`;
	});

	const timeString = $derived(
		current ? `${pad(current.hour)}:${pad(current.minute)}` : "",
	);

	/**
	 * Merge a calendar date pick with the current time-of-day (or zero), build
	 * a local-time `Date`, and emit its UTC ISO. The local-time `Date`
	 * constructor interprets the components in the runtime's timezone — which
	 * is exactly what the user means when they tap a day on the calendar.
	 */
	function handleDateChange(next: DateValue | undefined) {
		if (!next) return;
		const base = current;
		const picked = new Date(
			next.year,
			next.month - 1,
			next.day,
			base?.hour ?? 0,
			base?.minute ?? 0,
			base?.second ?? 0,
		);
		onChange(picked.toISOString());
	}

	function handleTimeChange(event: Event & { currentTarget: HTMLInputElement }) {
		const raw = event.currentTarget.value;
		if (!raw) return;
		const [hh, mm] = raw.split(":").map(Number);
		const baseDate = parsedDate ?? new Date();
		const picked = new Date(
			baseDate.getFullYear(),
			baseDate.getMonth(),
			baseDate.getDate(),
			Number.isFinite(hh) ? hh : 0,
			Number.isFinite(mm) ? mm : 0,
			0,
		);
		onChange(picked.toISOString());
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
					!parsedDate && "text-muted-foreground",
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
		<div class="border-t p-3">
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
