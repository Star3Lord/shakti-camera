import * as v from 'valibot';
import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { BSJ_BASE_URL } from '$env/static/private';
import { imageUrl, parseBSJTime } from '$lib/bsj';
import { bsjFetchAsset, fetchSnapshots, findDevice } from '$lib/server/bsj';
import { generateTimelinePdf, type PdfSnapshot } from '$lib/server/pdf-timeline';

const bodySchema = v.object({
	device_id: v.pipe(v.string(), v.minLength(1, 'device_id is required')),
	start_time: v.pipe(v.string(), v.minLength(1, 'start_time is required')),
	end_time: v.pipe(v.string(), v.minLength(1, 'end_time is required')),
	multi_type: v.optional(v.pipe(v.number(), v.minValue(0), v.maxValue(1)), 0),
	trip_id: v.optional(v.string(), ''),
	vehicle_number: v.optional(v.string(), ''),
	from_location: v.optional(v.string(), ''),
	to_location: v.optional(v.string(), ''),
	driver_name: v.optional(v.string(), ''),
	driver_contact: v.optional(v.string(), ''),
	consignor: v.optional(v.string(), ''),
});

/** Limit parallelism of upstream image fetches so we don't hammer BSJ. */
const IMAGE_CONCURRENCY = 6;

async function fetchAllImages(urls: string[]): Promise<Array<Buffer | null>> {
	const results: Array<Buffer | null> = new Array(urls.length).fill(null);
	let cursor = 0;

	const worker = async (): Promise<void> => {
		while (true) {
			const i = cursor++;
			if (i >= urls.length) return;
			try {
				results[i] = await bsjFetchAsset(urls[i]);
			} catch {
				results[i] = null;
			}
		}
	};

	const workers: Array<Promise<void>> = [];
	for (let i = 0; i < Math.min(IMAGE_CONCURRENCY, urls.length); i++) {
		workers.push(worker());
	}
	await Promise.all(workers);
	return results;
}

/** Filenames in HTTP headers must be ASCII; trim & strip anything weird. */
function safeFilename(deviceId: string, dateStr: string): string {
	const safeDevice = deviceId.replace(/[^A-Za-z0-9_-]/g, '');
	return `timeline-${safeDevice || 'device'}-${dateStr}.pdf`;
}

export const POST: RequestHandler = async ({ request, locals }) => {
	// API routes are not redirected by `hooks.server.ts`, so we 401 explicitly
	// instead of letting the upstream BSJ call fail with an opaque error.
	if (!locals.token || typeof locals.userId !== 'number') {
		throw error(401, 'Your session has expired. Please sign in again.');
	}

	let raw: unknown;
	try {
		raw = await request.json();
	} catch {
		throw error(400, 'Invalid JSON body');
	}

	let body: v.InferOutput<typeof bodySchema>;
	try {
		body = v.parse(bodySchema, raw);
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Invalid request body';
		throw error(400, message);
	}

	const device = await findDevice(body.device_id);
	const rawSnapshots = await fetchSnapshots(
		device.vehicleId,
		body.start_time,
		body.end_time,
		body.multi_type,
	);

	// Sort by capture time so the PDF reads chronologically regardless of
	// what order the upstream paged response returned them in.
	const enriched = rawSnapshots
		.map((s) => ({
			timeIso: parseBSJTime(s.operatorTime),
			url: imageUrl(BSJ_BASE_URL, s.previewPath),
		}))
		.sort((a, b) => a.timeIso.localeCompare(b.timeIso));

	const imageBuffers = await fetchAllImages(enriched.map((s) => s.url));

	const snapshots: PdfSnapshot[] = enriched.map((s, i) => ({
		image: imageBuffers[i],
		timeIso: s.timeIso,
	}));

	const pdf = await generateTimelinePdf({
		meta: {
			tripId: body.trip_id,
			vehicleNumber: body.vehicle_number,
			from: body.from_location,
			to: body.to_location,
			driverName: body.driver_name,
			driverContact: body.driver_contact,
			consignor: body.consignor,
			deviceId: body.device_id,
			startDate: body.start_time,
			endDate: body.end_time,
			multiType: body.multi_type,
		},
		snapshots,
	});

	const dateStr = body.start_time.slice(0, 10);
	const filename = safeFilename(body.device_id, dateStr);

	const pdfBytes = new Uint8Array(pdf);
	return new Response(pdfBytes, {
		headers: {
			'Content-Type': 'application/pdf',
			'Content-Disposition': `attachment; filename="${filename}"`,
			'Content-Length': String(pdfBytes.byteLength),
			'Cache-Control': 'no-store',
		},
	});
};
