import PDFDocument from 'pdfkit';

/** Snapshot input for the PDF, already enriched with an image buffer. */
export interface PdfSnapshot {
  /** Raw image bytes. `null` if the image could not be fetched. */
  image: Buffer | null;
  /** ISO 8601 capture time. */
  timeIso: string;
}

/**
 * Trip metadata for the cover header. The user-supplied fields are all
 * optional — when `undefined`, `null`, or empty/whitespace they are skipped
 * entirely (no row is rendered) instead of showing a placeholder dash, so the
 * header reflows compactly when the user opts most fields out via the dialog.
 */
export interface PdfTripMeta {
  tripId?: string | null;
  vehicleNumber?: string | null;
  from?: string | null;
  to?: string | null;
  driverName?: string | null;
  driverContact?: string | null;
  consignor?: string | null;
  /** Always present (required by the API). */
  deviceId: string;
  /** ISO 8601 (or BSJ "YYYY-MM-DD HH:MM:SS") */
  startDate: string;
  /** ISO 8601 (or BSJ "YYYY-MM-DD HH:MM:SS") */
  endDate: string;
  multiType: number;
}

/**
 * Optional "chrome" toggles that control the title, subtitle, auto-derived
 * cover rows, and footer. Every field is optional and defaults to "show" so
 * callers can pass an empty object (or omit it entirely) to keep the legacy
 * full-layout behaviour.
 */
export interface PdfChrome {
  /** Title text. `null`/`undefined` → omit the title block entirely. */
  title?: string | null;
  /** Show "Generated on …" timestamp under the title. Defaults to `true`. */
  showSubtitle?: boolean;
  /** Show the Start Date row in the cover entries. Defaults to `true`. */
  showStartDate?: boolean;
  /** Show the End Date row in the cover entries. Defaults to `true`. */
  showEndDate?: boolean;
  /** Show the Device ID row in the cover entries. Defaults to `true`. */
  showDeviceId?: boolean;
  /** Show the Snapshot Type row in the cover entries. Defaults to `true`. */
  showSnapshotType?: boolean;
  /** Footer brand line text. `null`/`undefined`/empty → omit the left footer. */
  footerText?: string | null;
  /** Show "Page X of Y" (plus vehicle suffix) on the footer right. Defaults to `true`. */
  showPageNumbers?: boolean;
  /**
   * Number of snapshot cells per row in the body grid. Fewer columns produce
   * larger cells (proportionally taller, keeping the 4:3 aspect). Defaults to
   * `3` to preserve the historical layout.
   */
  imagesPerRow?: 2 | 3;
}

export interface PdfBuildOptions {
  meta: PdfTripMeta;
  snapshots: PdfSnapshot[];
  /** Optional chrome toggles; defaults preserve the previous layout. */
  chrome?: PdfChrome;
  /** Override the "Generated on" timestamp; defaults to now. */
  generatedAt?: Date;
  /**
   * IANA timezone (e.g. `Asia/Kolkata`) used to render every date / time in
   * the PDF, so the output matches the wall-clock the user sees in the
   * timeline UI. Falls back to `UTC` if omitted or invalid.
   */
  timeZone?: string;
}

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

const CELL_GAP_X = 14;
const CELL_GAP_Y = 18;
const LABEL_GAP = 6;
const LABEL_HEIGHT = 14;
const HEADER_SPACE_AFTER = 18;
/** Reserved area at the bottom of every page for the running footer. */
const FOOTER_RESERVE = 24;

/**
 * Cell dimensions for a given column count. The image area keeps a 4:3 aspect
 * ratio (matches BSJ snapshots), so a wider cell becomes proportionally taller
 * and the grid stays visually balanced when the user opts into fewer columns.
 */
function computeGrid(cols: number): {
  cellW: number;
  cellImgH: number;
  rowH: number;
} {
  const cellW = (USABLE_W - CELL_GAP_X * (cols - 1)) / cols;
  const cellImgH = (cellW * 3) / 4;
  const rowH = cellImgH + LABEL_GAP + LABEL_HEIGHT;
  return { cellW, cellImgH, rowH };
}

/** Trimmed string when the caller supplied a non-empty value, otherwise `null`. */
function clean(value: string | undefined | null): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

/** Normalise BSJ "YYYY-MM-DD HH:MM:SS" timestamps to ISO so `new Date` works. */
function toDate(s: string): Date {
  const normalised = s.includes('T') ? s : s.replace(' ', 'T');
  const d = new Date(normalised);
  return isNaN(d.getTime()) ? new Date() : d;
}

/** Validate `timeZone` against the runtime's ICU data; falls back to UTC. */
function resolveTimeZone(timeZone: string | undefined): string {
  if (!timeZone) return 'UTC';
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return timeZone;
  } catch {
    return 'UTC';
  }
}

/**
 * Short timezone label (e.g. "EDT", "GMT+5:30"). V8 currently emits a numeric
 * offset for most non-North-American zones, which is still more useful than a
 * bare "UTC" when the user is elsewhere.
 */
function tzAbbr(d: Date, timeZone: string): string {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      timeZoneName: 'short',
    }).formatToParts(d);
    return parts.find((p) => p.type === 'timeZoneName')?.value ?? timeZone;
  } catch {
    return timeZone;
  }
}

/** "Sun, May 17, 2026 · 4:30 PM IST". */
function formatGeneratedAt(d: Date, timeZone: string): string {
  const date = d.toLocaleDateString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone,
  });
  const time = d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone,
  });
  return `${date} · ${time} ${tzAbbr(d, timeZone)}`;
}

/** "May 2, 2026 · 11:01 PM". */
function formatLongDateTime(s: string, timeZone: string): string {
  const d = toDate(s);
  const date = d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone,
  });
  const time = d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone,
  });
  return `${date} · ${time}`;
}

/** "Saturday, May 2, 2026". */
function formatSectionDate(iso: string, timeZone: string): string {
  return toDate(iso).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone,
  });
}

/** "5:30:42 PM" — seconds included so investigators can correlate exactly
 * with BSJ event timestamps, which are second-precise. */
function formatShortTime(iso: string, timeZone: string): string {
  return toDate(iso).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
    timeZone,
  });
}

/** Key snapshots by calendar day in `timeZone` so the section header per day
 * matches the per-image times beneath it. `en-CA` reliably emits ISO `YYYY-MM-DD`. */
function dayKey(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone,
  }).format(toDate(iso));
}

/** Bucket snapshots in stable order, by day in `timeZone`. */
function groupByDay(
  snapshots: PdfSnapshot[],
  timeZone: string
): Array<{ key: string; iso: string; items: PdfSnapshot[] }> {
  const map = new Map<
    string,
    { key: string; iso: string; items: PdfSnapshot[] }
  >();
  for (const s of snapshots) {
    const key = dayKey(s.timeIso, timeZone);
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
 *
 * Each block (title, subtitle, entries grid, dividers, accent rule) is
 * rendered only when the user opted to include it via `chrome`. If the user
 * disabled every block, this returns the bare top margin so the snapshot
 * grid begins immediately on the first page.
 */
function drawCoverHeader(
  doc: PDFKit.PDFDocument,
  meta: PdfTripMeta,
  chrome: PdfChrome,
  generatedAt: Date,
  timeZone: string
): number {
  const left = MARGIN;
  const right = PAGE_W - MARGIN;
  let y = MARGIN;

  const title = clean(chrome.title);
  const showSubtitle = chrome.showSubtitle !== false;

  // Build an ordered list of label/value entries; optional trip fields are
  // omitted when their value is missing/empty and the auto-derived snapshot
  // rows are omitted when the user toggled them off in the print dialog,
  // so the two-column grid reflows naturally as the cover gets shorter.
  const entries: Array<[string, string]> = [];
  const tripId = clean(meta.tripId);
  const vehicleNumber = clean(meta.vehicleNumber);
  const from = clean(meta.from);
  const to = clean(meta.to);
  const driverName = clean(meta.driverName);
  const driverContact = clean(meta.driverContact);
  const consignor = clean(meta.consignor);

  if (tripId) entries.push(['Trip ID', tripId]);
  if (vehicleNumber) entries.push(['Vehicle Number', vehicleNumber]);
  if (from) entries.push(['From', from]);
  if (to) entries.push(['To', to]);
  if (chrome.showStartDate !== false) {
    entries.push(['Start Date', formatLongDateTime(meta.startDate, timeZone)]);
  }
  if (chrome.showEndDate !== false) {
    entries.push(['End Date', formatLongDateTime(meta.endDate, timeZone)]);
  }
  if (driverName) entries.push(['Driver', driverName]);
  if (driverContact) entries.push(['Contact', driverContact]);
  if (consignor) entries.push(['Consignor', consignor]);
  if (chrome.showDeviceId !== false) {
    entries.push(['Device ID', meta.deviceId.trim()]);
  }
  if (chrome.showSnapshotType !== false) {
    entries.push([
      'Snapshot Type',
      meta.multiType === 0 ? 'Pictures' : 'Videos',
    ]);
  }

  const hasHeader = title !== null || showSubtitle;
  const hasEntries = entries.length > 0;

  // All cover blocks are disabled — return the bare top margin so the
  // snapshot grid begins immediately on the first page.
  if (!hasHeader && !hasEntries) {
    return MARGIN;
  }

  // Accent rule at the very top (only when something below it renders)
  doc.save();
  doc.rect(left, y, USABLE_W, 3).fill(COLORS.accent);
  doc.restore();
  y += 3 + 18;

  if (title !== null) {
    doc
      .font('Helvetica-Bold')
      .fontSize(22)
      .fillColor(COLORS.heading)
      .text(title, left, y, { width: USABLE_W, align: 'left' });
    y += 26;
  }

  if (showSubtitle) {
    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor(COLORS.muted)
      .text(
        `Generated on ${formatGeneratedAt(generatedAt, timeZone)}`,
        left,
        y,
        {
          width: USABLE_W,
          align: 'left',
        }
      );
    y += 18;
  }

  // Divider between the title block and the entries grid. Skipped when one
  // or the other is absent — we don't want a stray hairline floating above
  // nothing.
  if (hasHeader && hasEntries) {
    doc.save();
    doc
      .moveTo(left, y)
      .lineTo(right, y)
      .lineWidth(0.5)
      .strokeColor(COLORS.divider)
      .stroke();
    doc.restore();
    y += 16;
  }

  if (hasEntries) {
    const colW = (USABLE_W - 28) / 2;
    const col2X = left + colW + 28;
    const labelSize = 8;
    const valueSize = 11;
    const rowSpacing = 6;

    for (let i = 0; i < entries.length; i += 2) {
      const rowTop = y;
      const [l1, v1] = entries[i];
      doc
        .font('Helvetica')
        .fontSize(labelSize)
        .fillColor(COLORS.label)
        .text(l1.toUpperCase(), left, rowTop, {
          width: colW,
          characterSpacing: 0.6,
        });
      doc
        .font('Helvetica-Bold')
        .fontSize(valueSize)
        .fillColor(COLORS.value)
        .text(v1, left, rowTop + labelSize + 4, { width: colW });

      let rowBottom = rowTop + labelSize + 4 + valueSize + 2;

      const second = entries[i + 1];
      if (second) {
        const [l2, v2] = second;
        doc
          .font('Helvetica')
          .fontSize(labelSize)
          .fillColor(COLORS.label)
          .text(l2.toUpperCase(), col2X, rowTop, {
            width: colW,
            characterSpacing: 0.6,
          });
        doc
          .font('Helvetica-Bold')
          .fontSize(valueSize)
          .fillColor(COLORS.value)
          .text(v2, col2X, rowTop + labelSize + 4, { width: colW });

        const c2Bottom = rowTop + labelSize + 4 + valueSize + 2;
        rowBottom = Math.max(rowBottom, c2Bottom);
      }

      y = rowBottom + rowSpacing;
    }

    y += 8;
  }

  // Closing divider — drawn whenever any cover block rendered, so the
  // header always finishes with a clean hairline before the body grid.
  doc.save();
  doc
    .moveTo(left, y)
    .lineTo(right, y)
    .lineWidth(0.5)
    .strokeColor(COLORS.divider)
    .stroke();
  doc.restore();
  y += HEADER_SPACE_AFTER;

  return y;
}

/**
 * Compact running header for continuation pages. Mirrors the cover toggles:
 * the title slot uses `chrome.title` (so a custom title flows through to
 * every page), and the right-side trip/device identifier honours the
 * Device ID toggle as a sensible fallback when no trip ID is set.
 *
 * If nothing would render (no title, no trip ID, and device ID disabled),
 * the function returns the bare top margin so the body grid starts
 * immediately — matching the behaviour of the all-off cover.
 */
function drawContinuationHeader(
  doc: PDFKit.PDFDocument,
  meta: PdfTripMeta,
  chrome: PdfChrome
): number {
  const left = MARGIN;
  const right = PAGE_W - MARGIN;
  let y = MARGIN;

  const title = clean(chrome.title);
  const tripId = clean(meta.tripId);
  const vehicleNumber = clean(meta.vehicleNumber);

  // Right-side identifier prefers Trip ID; falls back to Device ID only
  // when the user kept the Device ID toggle on.
  let rightLine: string | null = null;
  if (tripId) {
    rightLine = `Trip ${tripId}`;
  } else if (chrome.showDeviceId !== false) {
    rightLine = `Device ${meta.deviceId}`;
  }
  const vehicleSuffix = vehicleNumber ? ` · ${vehicleNumber}` : '';

  if (!title && !rightLine && !vehicleSuffix) {
    // Nothing to render — start the body at the bare top margin.
    return MARGIN;
  }

  if (title) {
    doc
      .font('Helvetica-Bold')
      .fontSize(10)
      .fillColor(COLORS.heading)
      .text(title, left, y, { width: USABLE_W * 0.6, align: 'left' });
  }

  if (rightLine || vehicleSuffix) {
    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor(COLORS.muted)
      .text(`${rightLine ?? ''}${vehicleSuffix}`, left, y + 1, {
        width: USABLE_W,
        align: 'right',
      });
  }

  y += 18;

  doc.save();
  doc
    .moveTo(left, y)
    .lineTo(right, y)
    .lineWidth(0.5)
    .strokeColor(COLORS.divider)
    .stroke();
  doc.restore();
  y += 14;

  return y;
}

/** Section header inside the body grid that marks a new capture date. */
function drawDateSectionHeader(
  doc: PDFKit.PDFDocument,
  iso: string,
  count: number,
  y: number,
  timeZone: string
): number {
  const left = MARGIN;
  const right = PAGE_W - MARGIN;
  const label = formatSectionDate(iso, timeZone);
  const countLabel = `${count} snapshot${count === 1 ? '' : 's'}`;

  doc
    .font('Helvetica-Bold')
    .fontSize(10)
    .fillColor(COLORS.heading)
    .text(label, left, y, { width: USABLE_W, align: 'left' });

  doc
    .font('Helvetica')
    .fontSize(8.5)
    .fillColor(COLORS.muted)
    .text(countLabel, left, y, { width: USABLE_W, align: 'right' });

  const dividerY = y + 14;
  doc.save();
  doc
    .moveTo(left, dividerY)
    .lineTo(right, dividerY)
    .lineWidth(0.5)
    .strokeColor(COLORS.divider)
    .stroke();
  doc.restore();

  return dividerY + 10;
}

function drawImageCell(
  doc: PDFKit.PDFDocument,
  snap: PdfSnapshot,
  x: number,
  y: number,
  cellW: number,
  cellImgH: number,
  timeZone: string
): void {
  // The image is drawn with no surrounding chrome — no backdrop fill, no
  // border, no rounded clip. BSJ burns date/coordinate overlays into the
  // corners of each snapshot, and the previous rounded clip was visibly
  // shaving them off. The placeholder branch still gets a subtle gray
  // square so empty cells don't read as a layout bug.
  let imageDrawn = false;

  if (snap.image) {
    try {
      // `fit` scales the image to fit *inside* the cell while preserving
      // its native aspect ratio; combined with `align`/`valign: center`
      // any leftover space appears as equal letterbox margins. This is
      // the "contain" semantic the user requested — never crop.
      doc.image(snap.image, x, y, {
        fit: [cellW, cellImgH],
        align: 'center',
        valign: 'center',
      });
      imageDrawn = true;
    } catch {
      // PDFKit refused the image (e.g. unsupported PNG colour mode); fall
      // through to the placeholder below.
    }
  }

  if (!imageDrawn) {
    doc.save();
    doc.rect(x, y, cellW, cellImgH).fill(COLORS.subtle);
    doc.restore();
    doc
      .fillColor(COLORS.muted)
      .font('Helvetica')
      .fontSize(8)
      .text('Image unavailable', x, y + cellImgH / 2 - 4, {
        width: cellW,
        align: 'center',
      });
  }

  // Time label
  doc
    .font('Helvetica')
    .fontSize(9)
    .fillColor(COLORS.timeLabel)
    .text(
      formatShortTime(snap.timeIso, timeZone),
      x,
      y + cellImgH + LABEL_GAP,
      {
        width: cellW,
        align: 'center',
      }
    );
}

/**
 * Footer on every page; called after content is buffered. We draw inside the
 * reserved bottom area (just above the page margin) so PDFKit's auto-paginator
 * doesn't insert extra blank pages.
 *
 * Each half of the footer is independently toggleable. When both halves are
 * disabled the entire footer (including the hairline divider) is skipped so
 * the bottom of the page is genuinely empty.
 */
function drawFooter(
  doc: PDFKit.PDFDocument,
  pageNum: number,
  totalPages: number,
  meta: PdfTripMeta,
  chrome: PdfChrome
): void {
  const footerText = clean(chrome.footerText);
  const showPageNumbers = chrome.showPageNumbers !== false;

  if (!footerText && !showPageNumbers) return;

  const y = PAGE_H - MARGIN - 12;
  const left = MARGIN;
  const dividerY = y - 6;

  doc.save();
  doc
    .moveTo(left, dividerY)
    .lineTo(PAGE_W - MARGIN, dividerY)
    .lineWidth(0.25)
    .strokeColor(COLORS.divider)
    .stroke();
  doc.restore();

  if (footerText) {
    doc
      .font('Helvetica')
      .fontSize(8)
      .fillColor(COLORS.muted)
      .text(footerText, left, y, {
        width: USABLE_W * 0.6,
        align: 'left',
        lineBreak: false,
      });
  }

  if (showPageNumbers) {
    const vehicleNumber = clean(meta.vehicleNumber);
    const vehicleSuffix = vehicleNumber ? ` · ${vehicleNumber}` : '';
    doc
      .font('Helvetica')
      .fontSize(8)
      .fillColor(COLORS.muted)
      .text(`Page ${pageNum} of ${totalPages}${vehicleSuffix}`, left, y, {
        width: USABLE_W,
        align: 'right',
        lineBreak: false,
      });
  }
}

/**
 * Build the PDF body. Snapshots are grouped by calendar day; rows of
 * `chrome.imagesPerRow` cells are written until the page fills, then a new
 * page is added with a compact running header. Page numbers are written after
 * everything has been buffered.
 */
function buildPdf(doc: PDFKit.PDFDocument, opts: PdfBuildOptions): void {
  const { meta, snapshots } = opts;
  const chrome = opts.chrome ?? {};
  const generatedAt = opts.generatedAt ?? new Date();
  const timeZone = resolveTimeZone(opts.timeZone);
  const cols = chrome.imagesPerRow ?? 3;
  const { cellW, cellImgH, rowH } = computeGrid(cols);

  let y = drawCoverHeader(doc, meta, chrome, generatedAt, timeZone);

  const groups = groupByDay(snapshots, timeZone);

  if (snapshots.length === 0) {
    doc
      .font('Helvetica')
      .fontSize(11)
      .fillColor(COLORS.muted)
      .text(
        'No snapshots were captured by this device during the selected time range.',
        MARGIN,
        y + 24,
        { width: USABLE_W, align: 'center' }
      );
  }

  // Body must stop above the reserved footer region so the footer (drawn
  // later, after buffering) doesn't overlap the last row of cells. When the
  // footer is entirely disabled we reclaim that strip for body content.
  const footerVisible =
    clean(chrome.footerText) !== null || chrome.showPageNumbers !== false;
  const bodyBottom = PAGE_H - MARGIN - (footerVisible ? FOOTER_RESERVE : 0);
  const sectionHeaderH = 14 + 10;

  const ensureSpace = (needed: number): void => {
    if (y + needed > bodyBottom) {
      doc.addPage();
      y = drawContinuationHeader(doc, meta, chrome);
    }
  };

  for (const group of groups) {
    ensureSpace(sectionHeaderH + rowH);
    y = drawDateSectionHeader(doc, group.iso, group.items.length, y, timeZone);

    for (let i = 0; i < group.items.length; i += cols) {
      ensureSpace(rowH + (i + cols < group.items.length ? CELL_GAP_Y : 0));

      const rowItems = group.items.slice(i, i + cols);
      for (let c = 0; c < rowItems.length; c++) {
        const x = MARGIN + c * (cellW + CELL_GAP_X);
        drawImageCell(doc, rowItems[c], x, y, cellW, cellImgH, timeZone);
      }
      y += rowH + CELL_GAP_Y;
    }

    y += 4;
  }

  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    drawFooter(doc, i - range.start + 1, range.count, meta, chrome);
  }
}

export async function generateTimelinePdf(
  opts: PdfBuildOptions
): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: MARGIN,
      bufferPages: true,
      info: {
        Title: 'Timeline Report',
        Creator: '-',
        Producer: '-',
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
