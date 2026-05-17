import PDFDocument from 'pdfkit';

/** Snapshot input for the PDF, already enriched with an image buffer. */
export interface PdfSnapshot {
	/** Raw image bytes. `null` if the image could not be fetched. */
	image: Buffer | null;
	/** ISO 8601 capture time. */
	timeIso: string;
}

export interface PdfTripMeta {
	tripId: string;
	vehicleNumber: string;
	from: string;
	to: string;
	driverName: string;
	driverContact: string;
	consignor: string;
	deviceId: string;
	/** ISO 8601 (or BSJ "YYYY-MM-DD HH:MM:SS") */
	startDate: string;
	/** ISO 8601 (or BSJ "YYYY-MM-DD HH:MM:SS") */
	endDate: string;
	multiType: number;
}

export interface PdfBuildOptions {
	meta: PdfTripMeta;
	snapshots: PdfSnapshot[];
	/** Override the "Generated on" timestamp; defaults to now. */
	generatedAt?: Date;
}

const PLACEHOLDER = '—';

const COLORS = {
	heading: '#0a0a0a',
	value: '#18181b',
	label: '#71717a',
	muted: '#a1a1aa',
	timeLabel: '#3f3f46',
	divider: '#e4e4e7',
	subtle: '#f4f4f5',
	accent: '#0f172a',
	border: '#e4e4e7',
} as const;

const MARGIN = 48;
/** Width of an A4 page in pt. */
const PAGE_W = 595.28;
/** Height of an A4 page in pt. */
const PAGE_H = 841.89;
const USABLE_W = PAGE_W - MARGIN * 2;

const COLS = 3;
const CELL_GAP_X = 14;
const CELL_GAP_Y = 18;
const LABEL_GAP = 6;
const LABEL_HEIGHT = 14;
const CELL_W = (USABLE_W - CELL_GAP_X * (COLS - 1)) / COLS;
/** 4:3 photo aspect ratio matches BSJ snapshots. */
const CELL_IMG_H = (CELL_W * 3) / 4;
const ROW_H = CELL_IMG_H + LABEL_GAP + LABEL_HEIGHT;
const HEADER_SPACE_AFTER = 18;
/** Reserved area at the bottom of every page for the running footer. */
const FOOTER_RESERVE = 24;

/** Format a value, returning a placeholder dash if empty / whitespace. */
function fmt(value: string | undefined | null): string {
	const v = (value ?? '').trim();
	return v.length === 0 ? PLACEHOLDER : v;
}

function isPlaceholder(value: string): boolean {
	return value === PLACEHOLDER;
}

/** Normalise BSJ "YYYY-MM-DD HH:MM:SS" timestamps to ISO so `new Date` works. */
function toDate(s: string): Date {
	const normalised = s.includes('T') ? s : s.replace(' ', 'T');
	const d = new Date(normalised);
	return isNaN(d.getTime()) ? new Date() : d;
}

/** "Sun, May 17, 2026 · 4:30 PM" (UTC). */
function formatGeneratedAt(d: Date): string {
	const date = d.toLocaleDateString('en-US', {
		weekday: 'short',
		year: 'numeric',
		month: 'short',
		day: 'numeric',
		timeZone: 'UTC',
	});
	const time = d.toLocaleTimeString('en-US', {
		hour: 'numeric',
		minute: '2-digit',
		hour12: true,
		timeZone: 'UTC',
	});
	return `${date} · ${time} UTC`;
}

/** "May 2, 2026 · 11:01 PM" (UTC). */
function formatLongDateTime(s: string): string {
	const d = toDate(s);
	const date = d.toLocaleDateString('en-US', {
		year: 'numeric',
		month: 'short',
		day: 'numeric',
		timeZone: 'UTC',
	});
	const time = d.toLocaleTimeString('en-US', {
		hour: 'numeric',
		minute: '2-digit',
		hour12: true,
		timeZone: 'UTC',
	});
	return `${date} · ${time}`;
}

/** "Saturday, May 2, 2026" (UTC). */
function formatSectionDate(iso: string): string {
	return toDate(iso).toLocaleDateString('en-US', {
		weekday: 'long',
		year: 'numeric',
		month: 'long',
		day: 'numeric',
		timeZone: 'UTC',
	});
}

/** "5:30 PM" (UTC). */
function formatShortTime(iso: string): string {
	return toDate(iso).toLocaleTimeString('en-US', {
		hour: 'numeric',
		minute: '2-digit',
		hour12: true,
		timeZone: 'UTC',
	});
}

/** Key snapshots by UTC calendar day so we can render a section header per day. */
function dayKey(iso: string): string {
	return toDate(iso).toISOString().slice(0, 10);
}

/** Bucket snapshots in stable order, by UTC day. */
function groupByDay(snapshots: PdfSnapshot[]): Array<{ key: string; iso: string; items: PdfSnapshot[] }> {
	const map = new Map<string, { key: string; iso: string; items: PdfSnapshot[] }>();
	for (const s of snapshots) {
		const key = dayKey(s.timeIso);
		const group = map.get(key);
		if (group) {
			group.items.push(s);
		} else {
			map.set(key, { key, iso: s.timeIso, items: [s] });
		}
	}
	return [...map.values()];
}

/**
 * Draw the cover-style header on the current page.
 * Returns the Y coordinate where body content can begin.
 */
function drawCoverHeader(doc: PDFKit.PDFDocument, meta: PdfTripMeta, generatedAt: Date): number {
	const left = MARGIN;
	const right = PAGE_W - MARGIN;
	let y = MARGIN;

	// Accent rule at the very top
	doc.save();
	doc.rect(left, y, USABLE_W, 3).fill(COLORS.accent);
	doc.restore();
	y += 3 + 18;

	doc.font('Helvetica-Bold')
		.fontSize(22)
		.fillColor(COLORS.heading)
		.text('Snapshot Timeline Report', left, y, { width: USABLE_W, align: 'left' });
	y += 26;

	doc.font('Helvetica')
		.fontSize(9)
		.fillColor(COLORS.muted)
		.text(`Generated on ${formatGeneratedAt(generatedAt)}`, left, y, {
			width: USABLE_W,
			align: 'left',
		});
	y += 18;

	// Divider
	doc.save();
	doc.moveTo(left, y).lineTo(right, y).lineWidth(0.5).strokeColor(COLORS.divider).stroke();
	doc.restore();
	y += 16;

	// Metadata grid: two columns of label/value pairs.
	const rows: Array<[[string, string], [string, string] | null]> = [
		[
			['Trip ID', fmt(meta.tripId)],
			['Vehicle Number', fmt(meta.vehicleNumber)],
		],
		[
			['From', fmt(meta.from)],
			['To', fmt(meta.to)],
		],
		[
			['Start Date', formatLongDateTime(meta.startDate)],
			['End Date', formatLongDateTime(meta.endDate)],
		],
		[
			['Driver', fmt(meta.driverName)],
			['Contact', fmt(meta.driverContact)],
		],
		[
			['Consignor', fmt(meta.consignor)],
			['Device ID', fmt(meta.deviceId)],
		],
		[
			['Snapshot Type', meta.multiType === 0 ? 'Pictures' : 'Videos'],
			null,
		],
	];

	const colW = (USABLE_W - 28) / 2;
	const col2X = left + colW + 28;
	const labelSize = 8;
	const valueSize = 11;
	const rowSpacing = 6;

	for (const [c1, c2] of rows) {
		const rowTop = y;
		const [l1, v1] = c1;
		doc.font('Helvetica')
			.fontSize(labelSize)
			.fillColor(COLORS.label)
			.text(l1.toUpperCase(), left, rowTop, { width: colW, characterSpacing: 0.6 });
		doc.font(isPlaceholder(v1) ? 'Helvetica' : 'Helvetica-Bold')
			.fontSize(valueSize)
			.fillColor(isPlaceholder(v1) ? COLORS.muted : COLORS.value)
			.text(v1, left, rowTop + labelSize + 4, { width: colW });

		let rowBottom = rowTop + labelSize + 4 + valueSize + 2;

		if (c2) {
			const [l2, v2] = c2;
			doc.font('Helvetica')
				.fontSize(labelSize)
				.fillColor(COLORS.label)
				.text(l2.toUpperCase(), col2X, rowTop, { width: colW, characterSpacing: 0.6 });
			doc.font(isPlaceholder(v2) ? 'Helvetica' : 'Helvetica-Bold')
				.fontSize(valueSize)
				.fillColor(isPlaceholder(v2) ? COLORS.muted : COLORS.value)
				.text(v2, col2X, rowTop + labelSize + 4, { width: colW });

			const c2Bottom = rowTop + labelSize + 4 + valueSize + 2;
			rowBottom = Math.max(rowBottom, c2Bottom);
		}

		y = rowBottom + rowSpacing;
	}

	y += 8;
	// Closing divider before the body grid
	doc.save();
	doc.moveTo(left, y).lineTo(right, y).lineWidth(0.5).strokeColor(COLORS.divider).stroke();
	doc.restore();
	y += HEADER_SPACE_AFTER;

	return y;
}

/** Compact running header for continuation pages. */
function drawContinuationHeader(doc: PDFKit.PDFDocument, meta: PdfTripMeta): number {
	const left = MARGIN;
	const right = PAGE_W - MARGIN;
	let y = MARGIN;

	doc.font('Helvetica-Bold')
		.fontSize(10)
		.fillColor(COLORS.heading)
		.text('Snapshot Timeline Report', left, y, { width: USABLE_W * 0.6, align: 'left' });

	const rightLine =
		fmt(meta.tripId) === PLACEHOLDER ? `Device ${fmt(meta.deviceId)}` : `Trip ${fmt(meta.tripId)}`;
	const vehicleSuffix = fmt(meta.vehicleNumber) === PLACEHOLDER ? '' : ` · ${fmt(meta.vehicleNumber)}`;

	doc.font('Helvetica')
		.fontSize(9)
		.fillColor(COLORS.muted)
		.text(`${rightLine}${vehicleSuffix}`, left, y + 1, {
			width: USABLE_W,
			align: 'right',
		});
	y += 18;

	doc.save();
	doc.moveTo(left, y).lineTo(right, y).lineWidth(0.5).strokeColor(COLORS.divider).stroke();
	doc.restore();
	y += 14;

	return y;
}

/** Section header inside the body grid that marks a new capture date. */
function drawDateSectionHeader(doc: PDFKit.PDFDocument, iso: string, count: number, y: number): number {
	const left = MARGIN;
	const right = PAGE_W - MARGIN;
	const label = formatSectionDate(iso);
	const countLabel = `${count} snapshot${count === 1 ? '' : 's'}`;

	doc.font('Helvetica-Bold')
		.fontSize(10)
		.fillColor(COLORS.heading)
		.text(label, left, y, { width: USABLE_W, align: 'left' });

	doc.font('Helvetica')
		.fontSize(8.5)
		.fillColor(COLORS.muted)
		.text(countLabel, left, y, { width: USABLE_W, align: 'right' });

	const dividerY = y + 14;
	doc.save();
	doc.moveTo(left, dividerY).lineTo(right, dividerY).lineWidth(0.5).strokeColor(COLORS.divider).stroke();
	doc.restore();

	return dividerY + 10;
}

function drawImageCell(doc: PDFKit.PDFDocument, snap: PdfSnapshot, x: number, y: number): void {
	const radius = 6;

	// Image area with rounded clip
	if (snap.image) {
		doc.save();
		doc.roundedRect(x, y, CELL_W, CELL_IMG_H, radius).clip();
		try {
			doc.image(snap.image, x, y, { cover: [CELL_W, CELL_IMG_H], align: 'center', valign: 'center' });
		} catch {
			doc.rect(x, y, CELL_W, CELL_IMG_H).fill(COLORS.subtle);
			doc.fillColor(COLORS.muted)
				.font('Helvetica')
				.fontSize(8)
				.text('Image unavailable', x, y + CELL_IMG_H / 2 - 4, {
					width: CELL_W,
					align: 'center',
				});
		}
		doc.restore();
	} else {
		doc.save();
		doc.roundedRect(x, y, CELL_W, CELL_IMG_H, radius).fill(COLORS.subtle);
		doc.fillColor(COLORS.muted)
			.font('Helvetica')
			.fontSize(8)
			.text('Image unavailable', x, y + CELL_IMG_H / 2 - 4, {
				width: CELL_W,
				align: 'center',
			});
		doc.restore();
	}

	// Subtle border on top of the image
	doc.save();
	doc.roundedRect(x, y, CELL_W, CELL_IMG_H, radius)
		.lineWidth(0.5)
		.strokeColor(COLORS.border)
		.stroke();
	doc.restore();

	// Time label
	doc.font('Helvetica')
		.fontSize(9)
		.fillColor(COLORS.timeLabel)
		.text(formatShortTime(snap.timeIso), x, y + CELL_IMG_H + LABEL_GAP, {
			width: CELL_W,
			align: 'center',
		});
}

/**
 * Footer on every page; called after content is buffered. We draw inside the
 * reserved bottom area (just above the page margin) so PDFKit's auto-paginator
 * doesn't insert extra blank pages.
 */
function drawFooter(doc: PDFKit.PDFDocument, pageNum: number, totalPages: number, meta: PdfTripMeta): void {
	const y = PAGE_H - MARGIN - 12;
	const left = MARGIN;
	const dividerY = y - 6;

	doc.save();
	doc.moveTo(left, dividerY)
		.lineTo(PAGE_W - MARGIN, dividerY)
		.lineWidth(0.25)
		.strokeColor(COLORS.divider)
		.stroke();
	doc.restore();

	doc.font('Helvetica')
		.fontSize(8)
		.fillColor(COLORS.muted)
		.text('Monitoring · Snapshot Timeline Report', left, y, {
			width: USABLE_W * 0.6,
			align: 'left',
			lineBreak: false,
		});

	const vehicleSuffix = fmt(meta.vehicleNumber) === PLACEHOLDER ? '' : ` · ${fmt(meta.vehicleNumber)}`;
	doc.font('Helvetica')
		.fontSize(8)
		.fillColor(COLORS.muted)
		.text(`Page ${pageNum} of ${totalPages}${vehicleSuffix}`, left, y, {
			width: USABLE_W,
			align: 'right',
			lineBreak: false,
		});
}

/**
 * Build the PDF body. Snapshots are grouped by calendar day; rows of three
 * cells are written until the page fills, then a new page is added with a
 * compact running header. Page numbers are written after everything has been
 * buffered.
 */
function buildPdf(doc: PDFKit.PDFDocument, opts: PdfBuildOptions): void {
	const { meta, snapshots } = opts;
	const generatedAt = opts.generatedAt ?? new Date();

	let y = drawCoverHeader(doc, meta, generatedAt);

	const groups = groupByDay(snapshots);

	if (snapshots.length === 0) {
		doc.font('Helvetica')
			.fontSize(11)
			.fillColor(COLORS.muted)
			.text(
				'No snapshots were captured by this device during the selected time range.',
				MARGIN,
				y + 24,
				{ width: USABLE_W, align: 'center' },
			);
	}

	// Body must stop above the reserved footer region so the footer (drawn
	// later, after buffering) doesn't overlap the last row of cells.
	const bodyBottom = PAGE_H - MARGIN - FOOTER_RESERVE;
	const sectionHeaderH = 14 + 10;

	const ensureSpace = (needed: number): void => {
		if (y + needed > bodyBottom) {
			doc.addPage();
			y = drawContinuationHeader(doc, meta);
		}
	};

	for (const group of groups) {
		ensureSpace(sectionHeaderH + ROW_H);
		y = drawDateSectionHeader(doc, group.iso, group.items.length, y);

		for (let i = 0; i < group.items.length; i += COLS) {
			ensureSpace(ROW_H + (i + COLS < group.items.length ? CELL_GAP_Y : 0));

			const rowItems = group.items.slice(i, i + COLS);
			for (let c = 0; c < rowItems.length; c++) {
				const x = MARGIN + c * (CELL_W + CELL_GAP_X);
				drawImageCell(doc, rowItems[c], x, y);
			}
			y += ROW_H + CELL_GAP_Y;
		}

		y += 4;
	}

	const range = doc.bufferedPageRange();
	for (let i = range.start; i < range.start + range.count; i++) {
		doc.switchToPage(i);
		drawFooter(doc, i - range.start + 1, range.count, meta);
	}
}

export async function generateTimelinePdf(opts: PdfBuildOptions): Promise<Buffer> {
	return new Promise<Buffer>((resolve, reject) => {
		const doc = new PDFDocument({
			size: 'A4',
			margin: MARGIN,
			bufferPages: true,
			info: {
				Title: 'Snapshot Timeline Report',
				Creator: 'Monitoring',
				Producer: 'Monitoring',
			},
		});

		const chunks: Buffer[] = [];
		doc.on('data', (c: Buffer) => chunks.push(c));
		doc.on('end', () => resolve(Buffer.concat(chunks)));
		doc.on('error', reject);

		try {
			buildPdf(doc, opts);
			doc.end();
		} catch (err) {
			reject(err instanceof Error ? err : new Error(String(err)));
		}
	});
}
