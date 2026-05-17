<script lang="ts">
	import { enhance } from '$app/forms';
	import { CircleNotch, Eye, EyeSlash, MapPin, SignIn, WarningCircle } from 'phosphor-svelte';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import type { ActionData, PageData } from './$types';

	interface Props {
		data: PageData;
		form: ActionData;
	}

	let { data, form }: Props = $props();

	let submitting = $state(false);
	let showPassword = $state(false);
</script>

<svelte:head>
	<title>Sign in · Monitoring</title>
</svelte:head>

<div class="bg-background text-foreground flex min-h-screen items-center justify-center px-4 py-10">
	<Card.Root class="w-full max-w-sm">
		<Card.Header>
			<div class="bg-muted text-muted-foreground flex size-10 items-center justify-center rounded-lg">
				<MapPin weight="duotone" class="size-5" />
			</div>
			<Card.Title class="mt-3 text-lg font-semibold tracking-tight">
				Sign in to Monitoring
			</Card.Title>
			<Card.Description>
				Enter your BSJ credentials to access the device dashboard.
			</Card.Description>
		</Card.Header>

		<Card.Content class="space-y-5">
			{#if form?.error}
				<div
					role="alert"
					class="border-destructive/40 ring-destructive/20 bg-destructive/5 text-destructive flex items-start gap-2 rounded-lg p-3 text-sm ring-1"
				>
					<WarningCircle weight="duotone" class="mt-0.5 size-4 shrink-0" />
					<p class="text-destructive/90 break-words">{form.error}</p>
				</div>
			{/if}

			<form
				id="login-form"
				method="POST"
				class="space-y-4"
				use:enhance={() => {
					submitting = true;
					return async ({ update }) => {
						await update({ reset: false });
						submitting = false;
					};
				}}
			>
				<div class="space-y-2">
					<Label for="userName">Username</Label>
					<Input
						id="userName"
						name="userName"
						type="text"
						autocomplete="username"
						autocapitalize="none"
						autocorrect="off"
						spellcheck={false}
						required
						value={form?.userName ?? ''}
						placeholder="your.username"
						disabled={submitting}
					/>
				</div>

				<div class="space-y-2">
					<Label for="password">Password</Label>
					<div class="relative">
						<Input
							id="password"
							name="password"
							type={showPassword ? 'text' : 'password'}
							autocomplete="current-password"
							required
							placeholder="••••••••"
							disabled={submitting}
							class="pr-10"
						/>
						<button
							type="button"
							tabindex={-1}
							aria-label={showPassword ? 'Hide password' : 'Show password'}
							aria-pressed={showPassword}
							onclick={() => (showPassword = !showPassword)}
							class="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 absolute right-1 top-1/2 -translate-y-1/2 inline-flex size-7 items-center justify-center rounded-md outline-none transition-colors hover:bg-muted/60 focus-visible:ring-3"
						>
							{#if showPassword}
								<EyeSlash weight="duotone" class="size-4" />
							{:else}
								<Eye weight="duotone" class="size-4" />
							{/if}
						</button>
					</div>
				</div>

				<input type="hidden" name="next" value={data.next} />
			</form>
		</Card.Content>

		<Card.Footer class="flex-col gap-3">
			<Button
				type="submit"
				form="login-form"
				size="lg"
				disabled={submitting}
				class="w-full gap-2"
			>
				{#if submitting}
					<CircleNotch weight="bold" class="animate-spin" />
					Signing in…
				{:else}
					<SignIn weight="duotone" />
					Sign in
				{/if}
			</Button>
			<p class="text-muted-foreground w-full text-center text-xs leading-relaxed">
				Your credentials are sent securely to the BSJ server.
			</p>
		</Card.Footer>
	</Card.Root>
</div>
