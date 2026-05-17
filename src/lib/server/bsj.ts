import { error } from '@sveltejs/kit';
import { getRequestEvent } from '$app/server';
import { BSJ_BASE_URL } from '$env/static/private';
import type { BSJDevice, BSJSnapshot } from '$lib/bsj';

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

export async function listDevices(): Promise<BSJDevice[]> {
	const { userId } = requireSession();
	const res = await bsjFetch(`/webapi/monitor/loadSimpleByUsers?${API_VER}`, {
		userIds: [userId],
	});
	const json: BsjEnvelope<{ list?: Array<Record<string, unknown>> }> = await res.json();
	ensureBsjOk(res, json, 'loading devices');
	const groups = json?.data?.list ?? [];

	const devices: BSJDevice[] = [];
	for (const group of groups as Array<Record<string, unknown>>) {
		const children = (group.children as Array<Record<string, unknown>>) ?? [];
		for (const child of children) {
			devices.push({
				vehicleId: child.vehicleId as number,
				terminalNo: child.terminalNo as string,
				label: child.label as string,
				groupId: group.groupId as number,
				groupName: group.groupName as string | undefined,
				terminalType: child.terminalType as string | undefined,
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
 * Look up a device by terminalNo or vehicleId (numeric string).
 * Throws a structured 404 if the upstream succeeded but the device is not in
 * the user's device list, and a 502 (via `listDevices`) if the upstream
 * itself rejected (e.g. expired session).
 */
export async function findDevice(deviceId: string): Promise<BSJDevice> {
	const devices = await listDevices();
	const device = devices.find(
		(d) => d.terminalNo === deviceId || String(d.vehicleId) === deviceId,
	);
	if (!device) {
		throw error(404, `Device "${deviceId}" not found.`);
	}
	return device;
}
