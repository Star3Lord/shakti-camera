<script lang="ts">
	import { CaretDown, SignOut, User } from 'phosphor-svelte';
	import { goto } from '$app/navigation';
	import { buttonVariants } from '$lib/components/ui/button';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';

	interface Props {
		userName: string;
		align?: 'start' | 'center' | 'end';
	}

	let { userName, align = 'end' }: Props = $props();

	let signingOut = $state(false);

	async function logout() {
		if (signingOut) return;
		signingOut = true;
		try {
			// The /api/logout handler issues a 303 redirect after clearing the
			// cookie; we don't follow that redirect because we want to control
			// where the user lands and trigger a SvelteKit-aware navigation
			// (so server load functions re-run with the cleared session).
			await fetch('/api/logout', { method: 'POST', redirect: 'manual' });
		} catch {
			// Ignore — even if the request failed we still navigate to /login
			// so the user lands somewhere reasonable.
		}
		await goto('/login', { invalidateAll: true });
	}
</script>

<DropdownMenu.Root>
	<DropdownMenu.Trigger
		class={buttonVariants({
			variant: 'ghost',
			class: 'gap-2 max-w-[14rem]',
		})}
		aria-label="Account menu"
	>
		<span
			class="bg-muted text-muted-foreground flex size-6 items-center justify-center rounded-md"
		>
			<User weight="duotone" class="size-3.5" />
		</span>
		<span class="min-w-0 truncate text-sm font-medium">{userName}</span>
		<CaretDown class="text-muted-foreground size-3.5" />
	</DropdownMenu.Trigger>

	<DropdownMenu.Content {align} sideOffset={6} class="min-w-52">
		<DropdownMenu.Label class="flex flex-col gap-1">
			<span class="text-muted-foreground text-xs font-normal uppercase tracking-wider">
				Signed in as
			</span>
			<span class="text-foreground truncate text-sm font-medium">{userName}</span>
		</DropdownMenu.Label>

		<DropdownMenu.Separator />

		<DropdownMenu.Item
			variant="destructive"
			disabled={signingOut}
			onSelect={logout}
		>
			<SignOut weight="duotone" />
			{signingOut ? 'Signing out…' : 'Sign out'}
		</DropdownMenu.Item>
	</DropdownMenu.Content>
</DropdownMenu.Root>
