<script lang="ts">
	import {
		CircleNotch,
		FilePdf,
		Printer,
		WarningCircle,
	} from 'phosphor-svelte';
	import { Button } from '$lib/components/ui/button';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';

	interface Props {
		deviceId: string;
		startTime: string;
		endTime: string;
		multiType: number;
		open?: boolean;
	}

	let { deviceId, startTime, endTime, multiType, open = $bindable(false) }: Props = $props();

	let tripId = $state('');
	let vehicleNumber = $state('');
	let fromLocation = $state('');
	let toLocation = $state('');
	let driverName = $state('');
	let driverContact = $state('');
	let consignor = $state('');

	let isSubmitting = $state(false);
	let errorMessage = $state<string | null>(null);

	function handleOpenChange(next: boolean): void {
		// Clear any stale error from a previous attempt as the dialog opens,
		// but keep the form values so the user can quickly retry / tweak.
		if (next) errorMessage = null;
		open = next;
	}

	function deriveFilename(): string {
		const safeDevice = deviceId.replace(/[^A-Za-z0-9_-]/g, '') || 'device';
		const dateStr = startTime.slice(0, 10);
		return `timeline-${safeDevice}-${dateStr}.pdf`;
	}

	function triggerDownload(blob: Blob, filename: string): void {
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = filename;
		a.rel = 'noopener';
		document.body.appendChild(a);
		a.click();
		a.remove();
		// Give the browser a tick to start the download before revoking.
		setTimeout(() => URL.revokeObjectURL(url), 1000);
	}

	async function handleSubmit(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		if (isSubmitting) return;

		isSubmitting = true;
		errorMessage = null;

		try {
			const res = await fetch('/api/timeline/pdf', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					device_id: deviceId,
					start_time: startTime,
					end_time: endTime,
					multi_type: multiType,
					trip_id: tripId.trim(),
					vehicle_number: vehicleNumber.trim(),
					from_location: fromLocation.trim(),
					to_location: toLocation.trim(),
					driver_name: driverName.trim(),
					driver_contact: driverContact.trim(),
					consignor: consignor.trim(),
				}),
			});

			if (!res.ok) {
				let message = `Request failed with status ${res.status}`;
				try {
					const txt = await res.text();
					if (txt) {
						// SvelteKit `error()` responses come back as JSON
						// `{"message": "..."}`; everything else is treated as
						// raw text. Either way, surface something useful to
						// the user instead of a default status string.
						try {
							const parsed = JSON.parse(txt);
							if (parsed && typeof parsed.message === 'string') {
								message = parsed.message;
							} else {
								message = txt;
							}
						} catch {
							message = txt;
						}
					}
				} catch {
					// keep default
				}
				throw new Error(message);
			}

			const blob = await res.blob();
			triggerDownload(blob, deriveFilename());
			open = false;
		} catch (err) {
			errorMessage = err instanceof Error ? err.message : 'Something went wrong generating the PDF.';
		} finally {
			isSubmitting = false;
		}
	}

	function handleCancel(): void {
		if (isSubmitting) return;
		open = false;
	}
</script>

<Dialog.Root {open} onOpenChange={handleOpenChange}>
	<Dialog.Content class="sm:max-w-xl">
		<Dialog.Header class="pt-2">
			<Dialog.Title class="flex items-center gap-2">
				<FilePdf weight="duotone" class="text-primary size-5" />
				Generate timeline PDF
			</Dialog.Title>
			<Dialog.Description>
				Fill in the trip details below. All fields are optional — empty rows will be omitted from the PDF.
			</Dialog.Description>
		</Dialog.Header>

		<form onsubmit={handleSubmit} class="grid gap-4">
			<div class="grid gap-3 sm:grid-cols-2">
				<div class="grid gap-1.5">
					<Label for="print-trip-id">
						Trip ID
						<span class="text-muted-foreground" aria-hidden="true">*</span>
					</Label>
					<Input
						id="print-trip-id"
						bind:value={tripId}
						placeholder="e.g. 14887"
						autocomplete="off"
						disabled={isSubmitting}
					/>
				</div>

				<div class="grid gap-1.5">
					<Label for="print-vehicle-number">
						Vehicle Number
						<span class="text-muted-foreground" aria-hidden="true">*</span>
					</Label>
					<Input
						id="print-vehicle-number"
						bind:value={vehicleNumber}
						placeholder="e.g. CG22X6769"
						autocomplete="off"
						disabled={isSubmitting}
					/>
				</div>

				<div class="grid gap-1.5">
					<Label for="print-from">From</Label>
					<Input
						id="print-from"
						bind:value={fromLocation}
						placeholder="Origin location"
						autocomplete="off"
						disabled={isSubmitting}
					/>
				</div>

				<div class="grid gap-1.5">
					<Label for="print-to">To</Label>
					<Input
						id="print-to"
						bind:value={toLocation}
						placeholder="Destination location"
						autocomplete="off"
						disabled={isSubmitting}
					/>
				</div>

				<div class="grid gap-1.5">
					<Label for="print-driver-name">Driver Name</Label>
					<Input
						id="print-driver-name"
						bind:value={driverName}
						placeholder="Full name"
						autocomplete="off"
						disabled={isSubmitting}
					/>
				</div>

				<div class="grid gap-1.5">
					<Label for="print-driver-contact">Driver Contact</Label>
					<Input
						id="print-driver-contact"
						bind:value={driverContact}
						placeholder="Phone number"
						type="tel"
						inputmode="tel"
						autocomplete="off"
						disabled={isSubmitting}
					/>
				</div>

				<div class="grid gap-1.5 sm:col-span-2">
					<Label for="print-consignor">Consignor</Label>
					<Input
						id="print-consignor"
						bind:value={consignor}
						placeholder="Consignor name"
						autocomplete="off"
						disabled={isSubmitting}
					/>
				</div>
			</div>

			{#if errorMessage}
				<div
					class="border-destructive/40 bg-destructive/5 text-destructive flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm"
					role="alert"
				>
					<WarningCircle class="mt-0.5 size-4 shrink-0" weight="duotone" />
					<p class="leading-relaxed">{errorMessage}</p>
				</div>
			{/if}

			<Dialog.Footer class="mt-2">
				<Button
					type="button"
					variant="outline"
					onclick={handleCancel}
					disabled={isSubmitting}
				>
					Cancel
				</Button>
				<Button type="submit" disabled={isSubmitting} class="gap-1.5">
					{#if isSubmitting}
						<CircleNotch class="size-4 animate-spin" weight="bold" />
						Generating…
					{:else}
						<Printer weight="duotone" />
						Generate PDF
					{/if}
				</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
