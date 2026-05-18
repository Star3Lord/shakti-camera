<script lang="ts">
	import { MagnifyingGlass } from 'phosphor-svelte';
	import * as Card from '$lib/components/ui/card';
	import type { BSJAccount, BSJDevice } from '$lib/bsj';
	import AccountSection from './account-section.svelte';

	interface Props {
		accounts: BSJAccount[];
		allDevices: BSJDevice[];
		search: string;
	}

	let { accounts, allDevices, search }: Props = $props();

	/**
	 * Bucket devices by the BSJ `userId` field the upstream tags each group
	 * with. We do this once per (accounts, allDevices) change rather than
	 * inside the section loop so account sections render synchronously.
	 */
	const devicesByAccount = $derived.by(() => {
		const out: Record<number, BSJDevice[]> = {};
		for (const a of accounts) out[a.id] = [];
		for (const d of allDevices) {
			if (d.userId === undefined) continue;
			const bucket = out[d.userId];
			if (bucket) bucket.push(d);
		}
		return out;
	});

	const query = $derived(search.trim().toLowerCase());
	const searching = $derived(query.length > 0);

	/**
	 * One render entry per account, with the user's search applied. An
	 * account whose own name (or any ancestor name) matches the query keeps
	 * all of its devices — so typing "BAJRANG" shows BAJRANG's full device
	 * list rather than zero matches. Empty accounts (and search-misses) are
	 * filtered out so the page doesn't get cluttered.
	 */
	const sections = $derived.by(() => {
		const out: Array<{
			account: BSJAccount;
			devices: BSJDevice[];
			totalCount: number;
			accountMatches: boolean;
		}> = [];
		for (const account of accounts) {
			const devices = devicesByAccount[account.id] ?? [];
			const totalCount = devices.length;
			const accountMatches =
				searching &&
				(account.userName.toLowerCase().includes(query) ||
					account.ancestors.some((a) => a.toLowerCase().includes(query)));
			let filtered: BSJDevice[];
			if (!searching || accountMatches) {
				filtered = devices;
			} else {
				filtered = devices.filter((d) => {
					if (d.terminalNo.toLowerCase().includes(query)) return true;
					if (d.label && d.label.toLowerCase().includes(query)) return true;
					if (d.groupName && d.groupName.toLowerCase().includes(query)) return true;
					return false;
				});
			}
			const include = searching
				? filtered.length > 0 || accountMatches
				: totalCount > 0;
			if (include) {
				out.push({ account, devices: filtered, totalCount, accountMatches });
			}
		}
		return out;
	});
</script>

{#if sections.length === 0}
	<Card.Root class="mx-auto w-full max-w-md">
		<Card.Content class="flex flex-col items-center gap-4 px-6 py-12 text-center">
			<div
				class="bg-muted text-muted-foreground flex size-14 items-center justify-center rounded-full"
			>
				<MagnifyingGlass class="size-6" weight="duotone" />
			</div>
			<div class="space-y-1.5">
				<h2 class="text-foreground text-base font-medium">
					{searching ? 'No devices match' : 'No devices available'}
				</h2>
				<p class="text-muted-foreground text-sm leading-relaxed">
					{#if searching}
						No devices or accounts matched
						<span class="text-foreground font-mono">'{search}'</span>. Try a different query.
					{:else}
						There are no devices in any of your accounts yet.
					{/if}
				</p>
			</div>
		</Card.Content>
	</Card.Root>
{:else}
	<div class="space-y-4">
		{#each sections as section (section.account.id)}
			<AccountSection
				account={section.account}
				devices={section.devices}
				totalCount={section.totalCount}
				{searching}
			/>
		{/each}
	</div>
{/if}
