export interface BSJDevice {
	vehicleId: number;
	terminalNo: string;
	label: string;
	groupId: number;
	groupName?: string;
	terminalType?: string;
	/**
	 * Owner account user id. Populated when devices are loaded across
	 * sub-accounts so the picker can group / breadcrumb by account.
	 */
	userId?: number;
}

/**
 * One node in the user/account hierarchy returned by BSJ's
 * `/webapi/user/getUserTree`. We flatten the nested tree on the server and
 * pre-compute `ancestors` (the chain of parent userNames from root → parent)
 * so the picker can render a "VSS / VSS 1 / VSS MONITORING" breadcrumb
 * without recursing client-side.
 */
export interface BSJAccount {
	id: number;
	userName: string;
	parentId: number | null;
	ancestors: string[];
}

export interface BSJSnapshot {
	deviceId: number;
	deviceName: string;
	deviceNo: string;
	groupName: string;
	channel: number;
	multiType: number;
	operatorTime: string;
	lon: number;
	lat: number;
	previewPath: string;
	filePath: string;
	terminalType: string;
	mediaType: number;
}

export interface EnrichedSnapshot extends BSJSnapshot {
	imageUrl: string;
	address: string;
	mapsUrl: string;
}

/**
 * Convert a BSJ wall-clock string (`"YYYY-MM-DD HH:MM:SS"`, interpreted by
 * BSJ as CST / UTC+8) into a canonical UTC ISO 8601 timestamp. Used to
 * normalise snapshot capture times the moment they leave the API boundary,
 * so every downstream consumer can treat them as absolute instants.
 */
export function parseBSJTime(bsjTime: string): string {
	return new Date(bsjTime.replace(' ', 'T') + '+08:00').toISOString();
}

/**
 * Convert a canonical UTC ISO 8601 timestamp into the CST wall-clock string
 * format BSJ's `getMultiMedias` API expects (`"YYYY-MM-DD HH:MM:SS"`,
 * interpreted server-side as UTC+8). This is the inverse of `parseBSJTime`
 * and is the only place ISO → BSJ-format conversion should happen — keep
 * the BSJ format quirk pinned to the API boundary.
 */
export function isoToBsjWallClock(iso: string): string {
	const d = new Date(iso);
	if (isNaN(d.getTime())) {
		throw new Error(`Invalid ISO timestamp: ${iso}`);
	}
	const fmt = new Intl.DateTimeFormat('en-US', {
		timeZone: 'Asia/Shanghai',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
		hour12: false,
	});
	const parts: Record<string, string> = {};
	for (const p of fmt.formatToParts(d)) {
		if (p.type !== 'literal') parts[p.type] = p.value;
	}
	// `en-US` + `hour12: false` historically returned `24` for midnight in
	// some ICU builds; normalise to `00` so the BSJ API receives a value
	// it can parse cleanly.
	const hour = parts.hour === '24' ? '00' : parts.hour;
	return `${parts.year}-${parts.month}-${parts.day} ${hour}:${parts.minute}:${parts.second}`;
}

/**
 * Lightweight ISO-8601 validity check used by the timeline page to fall
 * back to defaults when the URL carries a malformed or legacy (pre-fix)
 * BSJ wall-clock value like `?start=2026-05-16+00:00:00`. We require a
 * `T` separator so the legacy space-separated format is treated as
 * invalid and the page reverts to `yesterdayRange()` rather than silently
 * interpreting the wrong instant.
 */
export function isValidIsoTimestamp(s: string | null | undefined): s is string {
	if (!s || !s.includes('T')) return false;
	return !isNaN(new Date(s).getTime());
}

/**
 * Default filter range used by the timeline page when the URL has no
 * `start`/`end`. Returns UTC ISO strings representing "yesterday" in the
 * runtime's local timezone (server local for SSR, client local for CSR).
 * When the server is UTC and the user is in a positive offset like IST,
 * the default may straddle a day boundary from the user's perspective —
 * accepted because the user can override via the picker.
 */
export function yesterdayRange(): { start: string; end: string } {
	const now = new Date();
	const startLocal = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0);
	const endLocal = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59);
	return { start: startLocal.toISOString(), end: endLocal.toISOString() };
}

export function imageUrl(baseUrl: string, path: string): string {
	return `${baseUrl}${path}`;
}
