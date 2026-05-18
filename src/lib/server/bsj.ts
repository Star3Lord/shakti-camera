import { error } from '@sveltejs/kit';
import { getRequestEvent } from '$app/server';
import { BSJ_BASE_URL } from '$env/static/private';
import type { BSJAccount, BSJDevice, BSJSnapshot } from '$lib/bsj';

const API_VER = '__sm_ver=1.26.1,20260506100316&platform=PC&version=base';

interface BsjEnvelope<T = unknown> {
	code?: number;
	msg?: string;
	subCode?: string;
	data?: T;
}

interface BsjSessionLocals {
	token: string;
	userId: number;
}

/**
 * Resolve the per-request BSJ session populated by `hooks.server.ts` from
 * the `bsj_session` cookie. Throws a 401 (the conventional "session expired"
 * status) when there is no logged-in user — the caller can choose whether
 * to surface that or let SvelteKit's error boundary handle it.
 */
function requireSession(): BsjSessionLocals {
	const event = getRequestEvent();
	const token = event.locals.token;
	const userId = event.locals.userId;
	if (!token || typeof userId !== 'number') {
		throw error(401, 'Your session has expired. Please sign in again.');
	}
	return { token, userId };
}

/**
 * Translate a BSJ response envelope into a thrown SvelteKit `HttpError` when
 * the upstream signalled a failure, so that the message survives to the
 * `<svelte:boundary>` `failed` snippet and to PDF dialog clients instead of
 * being sanitised to a generic "Internal Error".
 *
 * The most common failure here is `code: 504, subCode: "login.timeout"` which
 * happens when the BSJ session expires — surface that explicitly so the
 * user knows to sign in again.
 */
function ensureBsjOk(res: Response, envelope: BsjEnvelope, context: string): void {
	if (!res.ok) {
		throw error(502, `BSJ upstream returned HTTP ${res.status} while ${context}.`);
	}
	const code = envelope?.code;
	if (code !== undefined && code !== 0 && code !== 200) {
		const msg = envelope?.msg ?? 'unknown error';
		if (envelope?.subCode === 'login.timeout' || code === 504) {
			throw error(401, `BSJ session expired (${msg}). Please sign in again.`);
		}
		throw error(502, `BSJ upstream error while ${context}: ${msg} (code ${code}).`);
	}
}

/**
 * Internal helper to POST against the BSJ API with the current user's token
 * attached. Server-only: never importable from a client bundle because it
 * lives in `$lib/server/*` and reads the per-request locals.
 */
export async function bsjFetch(path: string, body: unknown): Promise<Response> {
	const { token } = requireSession();
	return fetch(`${BSJ_BASE_URL}${path}`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			token,
		},
		body: JSON.stringify(body),
	});
}

/**
 * Fetch a binary asset (image/video preview) from BSJ. BSJ media URLs are
 * served from the same origin and require the `token` header for access;
 * we always send the current user's token so callers don't have to think
 * about it.
 */
export async function bsjFetchAsset(url: string): Promise<Buffer> {
	const { token } = requireSession();
	const res = await fetch(url, {
		headers: { token },
	});
	if (!res.ok) {
		throw new Error(`Failed to fetch BSJ asset (${res.status}): ${url}`);
	}
	const ab = await res.arrayBuffer();
	return Buffer.from(ab);
}

interface RawAccountNode {
	id: number;
	userName?: string;
	name?: string;
	parentId?: number | null;
	children?: RawAccountNode[];
}

/**
 * Walk BSJ's nested `getUserTree` response into a flat `BSJAccount[]` with
 * pre-computed ancestor names. Order is depth-first so the picker can
 * render accounts in the same visual order as the BSJ webapp's dropdown.
 */
function flattenAccountTree(nodes: RawAccountNode[], ancestors: string[] = []): BSJAccount[] {
	const out: BSJAccount[] = [];
	for (const node of nodes) {
		const userName = node.userName ?? node.name ?? `User ${node.id}`;
		out.push({
			id: node.id,
			userName,
			parentId: node.parentId ?? null,
			ancestors,
		});
		if (node.children && node.children.length > 0) {
			out.push(...flattenAccountTree(node.children, [...ancestors, userName]));
		}
	}
	return out;
}

/**
 * Fetch the full account hierarchy that the logged-in user can access. The
 * upstream endpoint (`/webapi/user/getUserTree`) returns a nested tree of
 * `{ id, userName, parentId, children[] }` nodes; we flatten that into a
 * sequence the picker can group and render directly.
 */
export async function listAccounts(): Promise<BSJAccount[]> {
	requireSession();
	const res = await bsjFetch(`/webapi/user/getUserTree?${API_VER}`, {});
	const json: BsjEnvelope<RawAccountNode[]> = await res.json();
	ensureBsjOk(res, json, 'loading accounts');
	const tree = json?.data ?? [];
	return flattenAccountTree(tree);
}

/**
 * Fetch the devices owned by one or more BSJ user accounts. When called
 * without `userIds`, defaults to the logged-in user only — preserving the
 * pre-multi-account behaviour. Pass an explicit list (typically every id
 * from `listAccounts()`) to load every device across the user's tree in a
 * single round-trip; the response includes a `userId` on each group so
 * callers can re-bucket devices by owning account.
 */
export async function listDevices(userIds?: number[]): Promise<BSJDevice[]> {
	const { userId } = requireSession();
	const ids = userIds && userIds.length > 0 ? userIds : [userId];
	const res = await bsjFetch(`/webapi/monitor/loadSimpleByUsers?${API_VER}`, {
		userIds: ids,
	});
	const json: BsjEnvelope<{ list?: Array<Record<string, unknown>> }> = await res.json();
	ensureBsjOk(res, json, 'loading devices');
	const groups = json?.data?.list ?? [];

	const devices: BSJDevice[] = [];
	for (const group of groups as Array<Record<string, unknown>>) {
		const children = (group.children as Array<Record<string, unknown>>) ?? [];
		const groupUserId = group.userId as number | undefined;
		const groupId = group.groupId as number;
		const groupName = group.groupName as string | undefined;
		for (const child of children) {
			devices.push({
				vehicleId: child.vehicleId as number,
				terminalNo: child.terminalNo as string,
				label: child.label as string,
				groupId,
				groupName,
				terminalType: child.terminalType as string | undefined,
				userId: groupUserId,
			});
		}
	}
	return devices;
}

export async function fetchSnapshots(
	vehicleId: number,
	startTime: string,
	endTime: string,
	multiType: number,
): Promise<BSJSnapshot[]> {
	const all: BSJSnapshot[] = [];
	let page = 1;
	const pageSize = 50;

	while (true) {
		const res = await bsjFetch(`/webapi/multi/getMultiMedias?${API_VER}`, {
			startTime,
			endTime,
			vehicleIds: String(vehicleId),
			multiType,
			pageSize,
			pageNumber: page,
		});
		const json: BsjEnvelope<BSJSnapshot[]> = await res.json();
		ensureBsjOk(res, json, 'loading snapshots');
		const data: BSJSnapshot[] = json?.data ?? [];
		all.push(...data);

		if (data.length < pageSize) break;
		page++;
	}
	return all;
}

/**
 * Look up a device by terminalNo or vehicleId (numeric string) across every
 * account the user can access (their own + every sub-account in the tree).
 * Necessary because the timeline detail page is reachable by direct URL —
 * we shouldn't 404 a device just because it belongs to a sub-account rather
 * than the logged-in user. Throws 404 if the upstream succeeded but the
 * device is not in any accessible account, and 502 (via `listDevices`) if
 * the upstream itself rejected (e.g. expired session).
 */
export async function findDevice(deviceId: string): Promise<BSJDevice> {
	const accounts = await listAccounts();
	const ids = accounts.map((a) => a.id);
	const devices = await listDevices(ids);
	const device = devices.find(
		(d) => d.terminalNo === deviceId || String(d.vehicleId) === deviceId,
	);
	if (!device) {
		throw error(404, `Device "${deviceId}" not found.`);
	}
	return device;
}
