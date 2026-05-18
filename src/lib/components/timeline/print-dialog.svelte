<script lang="ts">
  import {
    CircleNotch,
    FilePdf,
    Printer,
    Rows,
    SquaresFour,
    WarningCircle,
  } from 'phosphor-svelte';
  import { Button } from '$lib/components/ui/button';
  import * as Dialog from '$lib/components/ui/dialog';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import { Separator } from '$lib/components/ui/separator';
  import * as Switch from '$lib/components/ui/switch';
  import * as ToggleGroup from '$lib/components/ui/toggle-group';

  interface Props {
    deviceId: string;
    startTime: string;
    endTime: string;
    multiType: number;
    open?: boolean;
  }

  let {
    deviceId,
    startTime,
    endTime,
    multiType,
    open = $bindable(false),
  }: Props = $props();

  // Kept in sync with the server-side defaults in `pdf-timeline.ts`; sending
  // these explicitly when the user clears the input lets us short-circuit
  // the "ON with empty text" case without a server round-trip surprise.
  const DEFAULT_TITLE = 'Snapshot Timeline Report';
  const DEFAULT_FOOTER = 'Monitoring · Snapshot Timeline Report';

  type TripFieldKey =
    | 'trip_id'
    | 'vehicle_number'
    | 'from_location'
    | 'to_location'
    | 'driver_name'
    | 'driver_contact'
    | 'consignor';

  interface TripFieldConfig {
    key: TripFieldKey;
    label: string;
    placeholder: string;
    type?: 'text' | 'tel';
    inputmode?: 'text' | 'tel';
    fullWidth?: boolean;
  }

  const tripFields: ReadonlyArray<TripFieldConfig> = [
    { key: 'trip_id', label: 'Trip ID', placeholder: 'e.g. 14887' },
    {
      key: 'vehicle_number',
      label: 'Vehicle Number',
      placeholder: 'e.g. CG22X6769',
    },
    { key: 'from_location', label: 'From', placeholder: 'Origin location' },
    { key: 'to_location', label: 'To', placeholder: 'Destination location' },
    { key: 'driver_name', label: 'Driver Name', placeholder: 'Full name' },
    {
      key: 'driver_contact',
      label: 'Driver Contact',
      placeholder: 'Phone number',
      type: 'tel',
      inputmode: 'tel',
    },
    {
      key: 'consignor',
      label: 'Consignor',
      placeholder: 'Consignor name',
      fullWidth: true,
    },
  ];

  type SnapshotDetailKey =
    | 'start_date'
    | 'end_date'
    | 'device_id'
    | 'snapshot_type';

  /** Locale-format an ISO/BSJ timestamp for the preview line; falls back to
   *  the raw string if parsing fails. The preview is purely informational —
   *  the PDF itself re-formats using the user's IANA timezone. */
  function formatPreview(iso: string): string {
    const normalised = iso.includes('T') ? iso : iso.replace(' ', 'T');
    const d = new Date(normalised);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  }

  const snapshotDetails = $derived<
    ReadonlyArray<{ key: SnapshotDetailKey; label: string; preview: string }>
  >([
    {
      key: 'start_date',
      label: 'Start Date',
      preview: formatPreview(startTime),
    },
    { key: 'end_date', label: 'End Date', preview: formatPreview(endTime) },
    { key: 'device_id', label: 'Device ID', preview: deviceId },
    {
      key: 'snapshot_type',
      label: 'Snapshot Type',
      preview: multiType === 0 ? 'Pictures' : 'Videos',
    },
  ]);

  // All toggles default to ON so the dialog matches the previous always-shown
  // behaviour; the user explicitly opts a field out of the PDF by flipping it off.

  // Trip metadata
  let tripEnabled = $state<Record<TripFieldKey, boolean>>({
    trip_id: true,
    vehicle_number: true,
    from_location: true,
    to_location: true,
    driver_name: true,
    driver_contact: true,
    consignor: true,
  });

  let tripValues = $state<Record<TripFieldKey, string>>({
    trip_id: '',
    vehicle_number: '',
    from_location: '',
    to_location: '',
    driver_name: '',
    driver_contact: '',
    consignor: '',
  });

  // Document — title text + toggle, subtitle toggle-only
  let titleEnabled = $state(true);
  let titleValue = $state(DEFAULT_TITLE);
  let subtitleEnabled = $state(true);

  // Snapshot details — values come from page state, only toggleable
  let snapshotDetailEnabled = $state<Record<SnapshotDetailKey, boolean>>({
    start_date: true,
    end_date: true,
    device_id: true,
    snapshot_type: true,
  });

  // Footer — brand line text + toggle, page numbers toggle-only
  let footerTextEnabled = $state(true);
  let footerTextValue = $state(DEFAULT_FOOTER);
  let pageNumbersEnabled = $state(true);

  // Layout — snapshot grid density. Modeled as a string because the
  // ToggleGroup primitive only emits/accepts string values; converted to a
  // number when building the request body. Defaults to "3" so existing users
  // see the historical layout.
  type ImagesPerRow = '2' | '3';
  let imagesPerRow = $state<ImagesPerRow>('3');

  // ToggleGroup `type="single"` emits `""` when the active item is clicked
  // to deselect; fall back to "3" so we always have a valid choice.
  function handleImagesPerRowChange(next: string): void {
    imagesPerRow = next === '2' ? '2' : '3';
  }

  let isSubmitting = $state(false);
  let errorMessage = $state<string | null>(null);

  function handleOpenChange(next: boolean): void {
    // Clear any stale error from a previous attempt as the dialog opens,
    // but keep the form values so the user can quickly retry / tweak.
    if (next) errorMessage = null;
    open = next;
  }

  function deriveFilename(): string {
    const safeDevice = deviceId.replace(/[^A-Za-z0-9_-]/g, '') || 'device';
    const dateStr = startTime.slice(0, 10);
    return `timeline-${safeDevice}-${dateStr}.pdf`;
  }

  function triggerDownload(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Give the browser a tick to start the download before revoking.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function resolveTimeZone(): string {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    } catch {
      return '';
    }
  }

  /** Return the trimmed value when the toggle is on and non-empty; otherwise null (skip). */
  function pickTripValue(key: TripFieldKey): string | null {
    if (!tripEnabled[key]) return null;
    const v = tripValues[key].trim();
    return v === '' ? null : v;
  }

  /**
   * Title and footer share the same pattern: toggle off → `null` (omit),
   * toggle on with non-empty text → trimmed value, toggle on with empty
   * text → server default. The server treats `null`/`undefined` as "skip",
   * any string as "render this".
   */
  function pickTextWithFallback(
    on: boolean,
    value: string,
    fallback: string
  ): string | null {
    if (!on) return null;
    const trimmed = value.trim();
    return trimmed === '' ? fallback : trimmed;
  }

  async function handleSubmit(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    if (isSubmitting) return;

    isSubmitting = true;
    errorMessage = null;

    try {
      const res = await fetch('/api/timeline/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          device_id: deviceId,
          start_time: startTime,
          end_time: endTime,
          multi_type: multiType,
          trip_id: pickTripValue('trip_id'),
          vehicle_number: pickTripValue('vehicle_number'),
          from_location: pickTripValue('from_location'),
          to_location: pickTripValue('to_location'),
          driver_name: pickTripValue('driver_name'),
          driver_contact: pickTripValue('driver_contact'),
          consignor: pickTripValue('consignor'),
          title: pickTextWithFallback(titleEnabled, titleValue, DEFAULT_TITLE),
          show_subtitle: subtitleEnabled,
          show_start_date: snapshotDetailEnabled.start_date,
          show_end_date: snapshotDetailEnabled.end_date,
          show_device_id: snapshotDetailEnabled.device_id,
          show_snapshot_type: snapshotDetailEnabled.snapshot_type,
          footer_text: pickTextWithFallback(
            footerTextEnabled,
            footerTextValue,
            DEFAULT_FOOTER
          ),
          show_page_numbers: pageNumbersEnabled,
          images_per_row: Number(imagesPerRow),
          time_zone: resolveTimeZone(),
        }),
      });

      if (!res.ok) {
        let message = `Request failed with status ${res.status}`;
        try {
          const txt = await res.text();
          if (txt) {
            // SvelteKit `error()` responses come back as JSON
            // `{"message": "..."}`; everything else is treated as
            // raw text. Either way, surface something useful to
            // the user instead of a default status string.
            try {
              const parsed = JSON.parse(txt);
              if (parsed && typeof parsed.message === 'string') {
                message = parsed.message;
              } else {
                message = txt;
              }
            } catch {
              message = txt;
            }
          }
        } catch {
          // keep default
        }
        throw new Error(message);
      }

      const blob = await res.blob();
      triggerDownload(blob, deriveFilename());
      open = false;
    } catch (err) {
      errorMessage =
        err instanceof Error
          ? err.message
          : 'Something went wrong generating the PDF.';
    } finally {
      isSubmitting = false;
    }
  }

  function handleCancel(): void {
    if (isSubmitting) return;
    open = false;
  }
</script>

{#snippet sectionHeader(title: string)}
  <h3
    class="text-xs font-semibold tracking-wide text-muted-foreground uppercase"
  >
    {title}
  </h3>
{/snippet}

<Dialog.Root {open} onOpenChange={handleOpenChange}>
  <Dialog.Content class="sm:max-w-xl">
    <Dialog.Header class="pt-2">
      <Dialog.Title class="flex items-center gap-2">
        <FilePdf weight="duotone" class="size-5 text-primary" />
        Generate timeline PDF
      </Dialog.Title>
      <Dialog.Description>
        Configure what appears in the PDF. Toggle off any row you don't want to
        include — disabled or empty fields are omitted entirely.
      </Dialog.Description>
    </Dialog.Header>

    <form onsubmit={handleSubmit} class="grid gap-4">
      <div class="grid max-h-[65vh] gap-5 overflow-y-auto pr-1">
        <section class="grid gap-3">
          {@render sectionHeader('Document')}

          <div class="space-y-1.5">
            <div class="flex items-center justify-between gap-2">
              <Label
                for="print-title"
                class={titleEnabled ? '' : 'text-muted-foreground'}
              >
                Title
              </Label>
              <Switch.Root
                bind:checked={titleEnabled}
                disabled={isSubmitting}
                aria-label="Include title in PDF"
              />
            </div>
            <Input
              id="print-title"
              bind:value={titleValue}
              placeholder={DEFAULT_TITLE}
              autocomplete="off"
              disabled={isSubmitting || !titleEnabled}
            />
          </div>

          <div class="space-y-1">
            <div class="flex items-center justify-between gap-2">
              <Label class={subtitleEnabled ? '' : 'text-muted-foreground'}>
                Generation timestamp
              </Label>
              <Switch.Root
                bind:checked={subtitleEnabled}
                disabled={isSubmitting}
                aria-label="Include generation timestamp in PDF"
              />
            </div>
            <p class="text-xs text-muted-foreground">
              Adds "Generated on …" below the title.
            </p>
          </div>
        </section>

        <Separator />

        <section class="grid gap-3">
          {@render sectionHeader('Layout')}

          <div class="space-y-1.5">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <Label>Images per row</Label>
              <ToggleGroup.Root
                type="single"
                variant="outline"
                value={imagesPerRow}
                onValueChange={handleImagesPerRowChange}
                disabled={isSubmitting}
                aria-label="Snapshot grid columns"
              >
                <ToggleGroup.Item
                  value="2"
                  aria-label="Two images per row"
                  class="gap-1.5"
                >
                  <Rows weight="duotone" />
                  2 per row
                </ToggleGroup.Item>
                <ToggleGroup.Item
                  value="3"
                  aria-label="Three images per row"
                  class="gap-1.5"
                >
                  <SquaresFour weight="duotone" />
                  3 per row
                </ToggleGroup.Item>
              </ToggleGroup.Root>
            </div>
            <p class="text-xs text-muted-foreground">
              Fewer columns mean larger snapshots on each page.
            </p>
          </div>
        </section>

        <Separator />

        <section class="grid gap-3">
          {@render sectionHeader('Trip metadata')}

          <div class="grid gap-3 sm:grid-cols-2">
            {#each tripFields as field (field.key)}
              {@const inputId = `print-${field.key.replace(/_/g, '-')}`}
              <div
                class={['space-y-1.5', field.fullWidth ? 'sm:col-span-2' : '']}
              >
                <div class="flex items-center justify-between gap-2">
                  <Label
                    for={inputId}
                    class={tripEnabled[field.key]
                      ? ''
                      : 'text-muted-foreground'}
                  >
                    {field.label}
                  </Label>
                  <Switch.Root
                    bind:checked={tripEnabled[field.key]}
                    disabled={isSubmitting}
                    aria-label={`Include ${field.label} in PDF`}
                  />
                </div>
                <Input
                  id={inputId}
                  bind:value={tripValues[field.key]}
                  placeholder={field.placeholder}
                  autocomplete="off"
                  type={field.type ?? 'text'}
                  inputmode={field.inputmode}
                  disabled={isSubmitting || !tripEnabled[field.key]}
                />
              </div>
            {/each}
          </div>
        </section>

        <Separator />

        <section class="grid gap-3">
          {@render sectionHeader('Snapshot details')}

          <div class="grid gap-3 sm:grid-cols-2">
            {#each snapshotDetails as detail (detail.key)}
              <div class="space-y-1">
                <div class="flex items-center justify-between gap-2">
                  <Label
                    class={snapshotDetailEnabled[detail.key]
                      ? ''
                      : 'text-muted-foreground'}
                  >
                    {detail.label}
                  </Label>
                  <Switch.Root
                    bind:checked={snapshotDetailEnabled[detail.key]}
                    disabled={isSubmitting}
                    aria-label={`Include ${detail.label} in PDF`}
                  />
                </div>
                <p
                  class="truncate text-xs text-muted-foreground"
                  title={detail.preview}
                >
                  {detail.preview}
                </p>
              </div>
            {/each}
          </div>
        </section>

        <Separator />

        <section class="grid gap-3">
          {@render sectionHeader('Footer')}

          <div class="space-y-1.5">
            <div class="flex items-center justify-between gap-2">
              <Label
                for="print-footer-text"
                class={footerTextEnabled ? '' : 'text-muted-foreground'}
              >
                Brand line
              </Label>
              <Switch.Root
                bind:checked={footerTextEnabled}
                disabled={isSubmitting}
                aria-label="Include footer brand line in PDF"
              />
            </div>
            <Input
              id="print-footer-text"
              bind:value={footerTextValue}
              placeholder={DEFAULT_FOOTER}
              autocomplete="off"
              disabled={isSubmitting || !footerTextEnabled}
            />
          </div>

          <div class="space-y-1">
            <div class="flex items-center justify-between gap-2">
              <Label class={pageNumbersEnabled ? '' : 'text-muted-foreground'}>
                Page numbers
              </Label>
              <Switch.Root
                bind:checked={pageNumbersEnabled}
                disabled={isSubmitting}
                aria-label="Include page numbers in PDF"
              />
            </div>
            <p class="text-xs text-muted-foreground">
              Adds "Page X of Y" on the right side of each page footer.
            </p>
          </div>
        </section>
      </div>

      {#if errorMessage}
        <div
          class="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2.5 text-sm text-destructive"
          role="alert"
        >
          <WarningCircle class="mt-0.5 size-4 shrink-0" weight="duotone" />
          <p class="leading-relaxed">{errorMessage}</p>
        </div>
      {/if}

      <Dialog.Footer class="mt-2">
        <Button
          type="button"
          variant="outline"
          onclick={handleCancel}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting} class="gap-1.5">
          {#if isSubmitting}
            <CircleNotch class="size-4 animate-spin" weight="bold" />
            Generating…
          {:else}
            <Printer weight="duotone" />
            Generate PDF
          {/if}
        </Button>
      </Dialog.Footer>
    </form>
  </Dialog.Content>
</Dialog.Root>
