export interface BSJDevice {
	vehicleId: number;
	terminalNo: string;
	label: string;
	groupId: number;
	groupName?: string;
	terminalType?: string;
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
