import * as v from 'valibot';
import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { BSJ_BASE_URL } from '$env/static/private';
import { imageUrl, isoToBsjWallClock, parseBSJTime } from '$lib/bsj';
import { bsjFetchAsset, fetchSnapshots, findDevice } from '$lib/server/bsj';
import {
  generateTimelinePdf,
  type PdfSnapshot,
} from '$lib/server/pdf-timeline';

/**
 * Each optional trip-metadata field accepts a string, `null`, or absence
 * (omitted from the JSON body). All three mean "skip this field in the PDF";
 * the dialog toggles emit `null` for disabled rows so the server doesn't need
 * to distinguish between unset and explicitly cleared.
 */
const OptionalField = v.optional(v.nullable(v.string()));

const bodySchema = v.object({
  device_id: v.pipe(v.string(), v.minLength(1, 'device_id is required')),
  /** UTC ISO 8601 timestamp; converted to BSJ wall-clock before fetching snapshots. */
  start_time: v.pipe(v.string(), v.minLength(1, 'start_time is required')),
  /** UTC ISO 8601 timestamp; converted to BSJ wall-clock before fetching snapshots. */
  end_time: v.pipe(v.string(), v.minLength(1, 'end_time is required')),
  multi_type: v.optional(v.pipe(v.number(), v.minValue(0), v.maxValue(1)), 0),
  trip_id: OptionalField,
  vehicle_number: OptionalField,
  from_location: OptionalField,
  to_location: OptionalField,
  driver_name: OptionalField,
  driver_contact: OptionalField,
  consignor: OptionalField,
  /**
   * Document chrome — title, subtitle, footer, and toggles for auto-derived
   * snapshot rows on the cover. `null`/absence means "omit" for the string
   * fields; the booleans default to `true` so callers that pre-date this
   * feature get the full layout.
   */
  title: OptionalField,
  show_subtitle: v.optional(v.boolean(), true),
  show_start_date: v.optional(v.boolean(), true),
  show_end_date: v.optional(v.boolean(), true),
  show_device_id: v.optional(v.boolean(), true),
  show_snapshot_type: v.optional(v.boolean(), true),
  footer_text: OptionalField,
  show_page_numbers: v.optional(v.boolean(), true),
  /**
   * Snapshot grid layout — number of image cells per row in the body grid.
   * Only 2 or 3 are supported; fewer columns means bigger cells. Defaults
   * to 3 to preserve the historical layout when clients omit the field.
   */
  images_per_row: v.optional(v.union([v.literal(2), v.literal(3)]), 3),
  /** Browser-resolved IANA timezone; the PDF renders timestamps in this zone. */
  time_zone: v.optional(v.string(), ''),
});

/** Normalise an optional field to a trimmed string or `undefined` (skip). */
function pickOptional(value: string | null | undefined): string | undefined {
  if (value == null) return undefined;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

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

  // BSJ's `getMultiMedias` expects CST wall-clock strings; convert the
  // canonical UTC ISO inputs right at the boundary so the rest of the
  // pipeline (and the PDF cover) keeps the absolute-instant semantics.
  let bsjStart: string;
  let bsjEnd: string;
  try {
    bsjStart = isoToBsjWallClock(body.start_time);
    bsjEnd = isoToBsjWallClock(body.end_time);
  } catch {
    throw error(400, 'start_time and end_time must be ISO 8601 timestamps.');
  }

  const rawSnapshots = await fetchSnapshots(
    device.vehicleId,
    bsjStart,
    bsjEnd,
    body.multi_type
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
      tripId: pickOptional(body.trip_id),
      vehicleNumber: pickOptional(body.vehicle_number),
      from: pickOptional(body.from_location),
      to: pickOptional(body.to_location),
      driverName: pickOptional(body.driver_name),
      driverContact: pickOptional(body.driver_contact),
      consignor: pickOptional(body.consignor),
      deviceId: body.device_id,
      startDate: body.start_time,
      endDate: body.end_time,
      multiType: body.multi_type,
    },
    chrome: {
      title: pickOptional(body.title),
      showSubtitle: body.show_subtitle,
      showStartDate: body.show_start_date,
      showEndDate: body.show_end_date,
      showDeviceId: body.show_device_id,
      showSnapshotType: body.show_snapshot_type,
      footerText: pickOptional(body.footer_text),
      showPageNumbers: body.show_page_numbers,
      imagesPerRow: body.images_per_row,
    },
    snapshots,
    timeZone: body.time_zone || undefined,
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
