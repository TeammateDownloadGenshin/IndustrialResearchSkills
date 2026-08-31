# Workbook Layout

## Workbook structure

The workbook contains one `Index` sheet followed by one sheet per semantic block. The manifest may override user-facing labels to match the input report language, but the builder's default labels are English.

## Index sheet

The index contains:

- Report title, report date, date source, input filename, and SHA-256. A fallback date source includes the suffix `(fallback)`.
- Block ID.
- Evidence sheet name.
- Original report page or pages.
- Block type.
- Topic and claim summary.
- Evidence count.
- Coverage status.
- Internal workbook link.

Use `covered`, `partial`, and `unresolved` status colors consistently: green, amber, and red.

## Evidence sheet geometry

- Columns `A:N`: original report capture area.
- Column `O`: narrow solid red divider.
- Columns `P:AM`: supporting evidence area.
- Rows 1 to 3: title, status, and section labels.
- Row 4 onward: vertically stacked images and evidence cards.

Hide gridlines and freeze the top three rows. Preserve image aspect ratios. Do not stretch text captures.

## Original capture area

- Place all source images for the block in page order.
- Fit each image within the left area without reducing text below readable size.
- Stack multiple images with a small vertical gap.
- Preserve headings, captions, legends, units, and source notes inside the crop.

## Evidence cards

Each evidence card contains:

1. Evidence ID, source type, publication date, and mapped claim IDs.
2. Publisher and source title.
3. A full clickable URL displayed as plain text.
4. A supporting screenshot below the URL.
5. A short evidence note when support is partial or derived.

Stack cards vertically. Use a light neutral border and enough spacing to prevent cards from appearing merged.

## Unresolved panel

If one or more material claims remain unresolved, add a red panel in the right area after any accepted evidence. List the claim IDs, claim text, search scope, and failure reason. Never leave the right side blank for an unresolved block.

## Images

- Use PNG for text-heavy report and web captures.
- Limit the longest edge to about 1600 pixels unless a larger image is required for legibility.
- Use targeted crops instead of full-page images when possible.
- Validate every final sheet through rendering, not only through XML or cell inspection.

## Sheet names

Use `B001_Topic`, remove `[]:*?/\\`, keep names unique, and limit names to 31 characters. When the topic is empty, use the block type. Add a numeric suffix when truncation creates a duplicate.
