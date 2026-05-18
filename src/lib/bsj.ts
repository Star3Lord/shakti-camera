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

export function parseBSJTime(bsjTime: string): string {
	return new Date(bsjTime.replace(' ', 'T') + '+08:00').toISOString();
}

export function formatDateTime(d: Date, end = false): string {
	const pad = (n: number) => String(n).padStart(2, '0');
	const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
	const time = end ? '23:59:59' : '00:00:00';
	return `${date} ${time}`;
}

export function yesterdayRange(): { start: string; end: string } {
	const d = new Date();
	d.setDate(d.getDate() - 1);
	return { start: formatDateTime(d, false), end: formatDateTime(d, true) };
}

export function imageUrl(baseUrl: string, path: string): string {
	return `${baseUrl}${path}`;
}
