import * as v from 'valibot';
import { query } from '$app/server';
import { BSJ_BASE_URL } from '$env/static/private';
import {
	parseBSJTime,
	imageUrl,
	yesterdayRange,
	type BSJAccount,
	type BSJDevice,
	type EnrichedSnapshot,
} from '$lib/bsj';
import { fetchSnapshots, findDevice, listAccounts, listDevices } from '$lib/server/bsj';

export interface TimelineResult {
	snapshots: EnrichedSnapshot[];
	deviceName: string;
	startTime: string;
	endTime: string;
	multiType: number;
}

async function reverseGeocode(
	coords: Array<{ lat: number; lon: number }>,
): Promise<Map<string, string>> {
	const cache = new Map<string, string>();

	const unique = coords.filter((c) => {
		const key = `${c.lat.toFixed(4)},${c.lon.toFixed(4)}`;
		if (cache.has(key)) return false;
		cache.set(key, '');
		return true;
	});

	for (const coord of unique) {
		const key = `${coord.lat.toFixed(4)},${coord.lon.toFixed(4)}`;
		try {
			const res = await fetch(
				`https://nominatim.openstreetmap.org/reverse?lat=${coord.lat}&lon=${coord.lon}&format=json&accept-language=en`,
				{ headers: { 'User-Agent': 'BSJ-Monitoring/1.0' } },
			);
			if (res.ok) {
				const json = await res.json();
				cache.set(key, json.display_name ?? `${coord.lat}, ${coord.lon}`);
			} else {
				cache.set(key, `${coord.lat}, ${coord.lon}`);
			}
		} catch {
			cache.set(key, `${coord.lat}, ${coord.lon}`);
		}
		if (unique.indexOf(coord) < unique.length - 1) {
			await new Promise((r) => setTimeout(r, 1100));
		}
	}

	return cache;
}

export const list_accounts = query(async (): Promise<BSJAccount[]> => {
	return listAccounts();
});

/**
 * Returns the device list for a single account. When `user_id` is omitted
 * the logged-in user's own devices are returned — preserves the original
 * single-user behaviour. The device picker prefers `list_all_devices` for
 * a single round-trip across the whole tree; `list_devices` is kept so
 * targeted refreshes ("just reload BAJRANG") stay cheap.
 */
export const list_devices = query(
	v.optional(
		v.object({
			user_id: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1))),
		}),
		{},
	),
	async (args): Promise<BSJDevice[]> => {
		const userId = args?.user_id;
		return listDevices(userId ? [userId] : undefined);
	},
);

/**
 * Returns every device across every account the logged-in user can access
 * (their own account + the full sub-tree from `listAccounts()`). Performed
 * as a single upstream call to `/webapi/monitor/loadSimpleByUsers` with
 * every account id, since BSJ groups its response by owning `userId` — we
 * keep that field on each `BSJDevice` so the picker can re-bucket devices
 * by account without making N additional requests.
 */
export const list_all_devices = query(async (): Promise<BSJDevice[]> => {
	const accounts = await listAccounts();
	const ids = accounts.map((a) => a.id);
	return listDevices(ids);
});

export const get_timeline = query(
	v.object({
		device_id: v.string(),
		start_time: v.optional(v.string()),
		end_time: v.optional(v.string()),
		multi_type: v.optional(v.pipe(v.number(), v.minValue(0), v.maxValue(1)), 0),
	}),
	async (args): Promise<TimelineResult> => {
		const { start, end } = yesterdayRange();
		const startTime = args.start_time ?? start;
		const endTime = args.end_time ?? end;
		const multiType = args.multi_type ?? 0;

		const device = await findDevice(args.device_id);
		const rawSnapshots = await fetchSnapshots(device.vehicleId, startTime, endTime, multiType);

		const coords = rawSnapshots
			.filter((s) => s.lat !== 0 && s.lon !== 0)
			.map((s) => ({ lat: s.lat, lon: s.lon }));

		const addressMap = coords.length > 0 ? await reverseGeocode(coords) : new Map<string, string>();

		const snapshots: EnrichedSnapshot[] = rawSnapshots.map((s) => {
			const key = `${s.lat.toFixed(4)},${s.lon.toFixed(4)}`;
			const address = addressMap.get(key) ?? `${s.lat}, ${s.lon}`;
			return {
				...s,
				operatorTime: parseBSJTime(s.operatorTime),
				imageUrl: imageUrl(BSJ_BASE_URL, s.previewPath),
				address,
				mapsUrl: `https://www.google.com/maps?q=${s.lat},${s.lon}`,
			};
		});

		return {
			snapshots,
			deviceName: device.label || device.terminalNo,
			startTime,
			endTime,
			multiType,
		};
	},
);
