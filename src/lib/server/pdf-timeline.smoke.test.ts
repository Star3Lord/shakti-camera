/**
 * Smoke test that generates a PDF using stub snapshot data and writes it to
 * `/tmp/pdf-timeline-smoke.pdf` so it can be opened/inspected manually.
 *
 * This is intentionally a single happy-path scenario; the goal is to confirm
 * that the layout code paths run without throwing in a Node/SSR environment
 * (pdfkit imports, font lookups, image drawing, page wrapping, page numbers).
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { generateTimelinePdf, type PdfSnapshot } from './pdf-timeline';

// Tiny 4x3 solid-color PNG generated inline so the test has no fixtures.
// PDFKit ignores indexed-color PNGs so this will hit the placeholder branch,
// but if a real JPEG is on disk at `/tmp/test-snap.jpg` we use that instead
// to visually verify the photo grid in the generated PDF.
const STUB_PNG = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAQAAAADCAYAAAC09K7GAAAAFUlEQVQIW2P8z8DwnwEJMA4eAQDgWQYBOIxhCgAAAABJRU5ErkJggg==',
	'base64',
);

const REAL_JPEG = existsSync('/tmp/test-snap.jpg')
	? readFileSync('/tmp/test-snap.jpg')
	: null;
const STUB_IMAGE = REAL_JPEG ?? STUB_PNG;

function makeSnapshots(n: number, startIso: string): PdfSnapshot[] {
	const start = new Date(startIso).getTime();
	const snaps: PdfSnapshot[] = [];
	for (let i = 0; i < n; i++) {
		const t = new Date(start + i * 15 * 60 * 1000).toISOString();
		snaps.push({
			image: i % 7 === 0 ? null : STUB_IMAGE, // exercise "image unavailable" cells too
			timeIso: t,
		});
	}
	return snaps;
}

describe('generateTimelinePdf', () => {
	it('produces a non-trivial PDF with the standard %PDF header', async () => {
		const snapshots = [
			...makeSnapshots(11, '2026-05-02T05:30:00Z'),
			...makeSnapshots(13, '2026-05-03T06:00:00Z'),
		];

		const pdf = await generateTimelinePdf({
			meta: {
				tripId: '14887',
				vehicleNumber: 'CG22X6769',
				from: 'Amgaon',
				to: 'Lala Pipes',
				driverName: 'Vikash',
				driverContact: '6264981595',
				consignor: 'Hanukripa',
				deviceId: '025491830583',
				startDate: '2026-05-02 05:30:00',
				endDate: '2026-05-03 10:30:00',
				multiType: 0,
			},
			snapshots,
			generatedAt: new Date('2026-05-17T11:00:00Z'),
		});

		writeFileSync('/tmp/pdf-timeline-smoke.pdf', pdf);

		const header = pdf.subarray(0, 4).toString('utf8');
		expect(header).toBe('%PDF');
		expect(pdf.byteLength).toBeGreaterThan(2000);
	});

	it('handles zero snapshots gracefully (just the cover header)', async () => {
		const pdf = await generateTimelinePdf({
			meta: {
				tripId: '',
				vehicleNumber: '',
				from: '',
				to: '',
				driverName: '',
				driverContact: '',
				consignor: '',
				deviceId: 'TESTDEV',
				startDate: '2026-05-02 00:00:00',
				endDate: '2026-05-02 23:59:59',
				multiType: 1,
			},
			snapshots: [],
			generatedAt: new Date('2026-05-17T11:00:00Z'),
		});

		expect(pdf.subarray(0, 4).toString('utf8')).toBe('%PDF');
		expect(pdf.byteLength).toBeGreaterThan(800);
	});
});
