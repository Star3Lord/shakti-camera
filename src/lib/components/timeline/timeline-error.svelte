<script lang="ts">
	import { ArrowClockwise, WarningCircle } from 'phosphor-svelte';
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';

	interface Props {
		error: unknown;
		reset: () => void;
	}

	let { error, reset }: Props = $props();

	// `<svelte:boundary>` may hand us either a plain `Error`, a SvelteKit
	// `HttpError` (which is NOT an `Error` subclass — it has `.body.message`),
	// or in worst case an unknown value. Dig for a string message before
	// falling back to `String(...)` which would otherwise stringify HttpError
	// to its raw JSON body.
	function extractMessage(err: unknown): string {
		if (err instanceof Error) return err.message;
		if (typeof err === 'string') return err;
		if (err && typeof err === 'object') {
			const obj = err as { message?: unknown; body?: { message?: unknown } };
			if (typeof obj.body?.message === 'string') return obj.body.message;
			if (typeof obj.message === 'string') return obj.message;
		}
		return String(err);
	}

	const message = $derived(extractMessage(error));
</script>

<Card.Root
	class="border-destructive/40 ring-destructive/20 bg-destructive/5 mx-auto w-full max-w-md"
	role="alert"
>
	<Card.Header class="border-b border-destructive/20 pb-4">
		<Card.Title class="text-destructive flex items-center gap-2 text-base font-medium">
			<WarningCircle weight="duotone" class="size-4" />
			Couldn't load timeline
		</Card.Title>
		<Card.Description class="text-destructive/80">
			Something went wrong while fetching snapshots for this device.
		</Card.Description>
	</Card.Header>
	<Card.Content class="pt-4">
		<p class="text-destructive/90 bg-destructive/5 ring-destructive/20 break-words rounded-lg p-3 font-mono text-xs leading-relaxed ring-1">
			{message}
		</p>
	</Card.Content>
	<Card.Footer class="border-t border-destructive/20 pt-4">
		<Button
			type="button"
			onclick={reset}
			variant="outline"
			class="gap-1.5"
		>
			<ArrowClockwise />
			Try again
		</Button>
	</Card.Footer>
</Card.Root>
