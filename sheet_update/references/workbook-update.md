# Workbook Update Rules

## Workbook mapping

Render and inspect all sheets before editing. A period-related sheet contains at least one period axis, period-dependent formula block, or chart whose series depends on such a block. Non-period sheets include static product lists, ANDA lists, reference tables, and other content with no period dependency.

Record protected sheets explicitly. Preserve their cell values, formulas, order, visibility, and drawing counts.

## Update order

1. Copy the nearest comparable period row or column to extend formatting, merged-cell conventions, formulas, and conditional formatting.
2. Replace the copied period label and direct reported inputs.
3. Replace copied formulas with period-correct, auditable formulas where necessary.
4. Extend every affected chart series and category axis.
5. Add source comments to direct reported values.
6. Add filing evidence cards beneath the lowest existing used cell or drawing.

Do not use proprietary external functions in new cells. Existing external functions and cached errors may remain only if they are part of the recorded baseline.

## Evidence cards

For each changed sheet, place only the evidence relevant to that sheet. Deduplicate identical screenshots within the sheet.

Each card contains:

- Source ID, official report title, disclosure date, PDF page, and supported cell addresses.
- A full clickable URL on the next line.
- The smallest readable highlighted crop below the URL.

Use a pale-yellow highlight and a red outline around supporting lines. Place unresolved items in a light-red panel with a dark-red border and an explicit reason. Never let a card overlap existing tables, charts, or images.

## Chart updates

Use explicit manifest instructions for chart series and category formulas. Verify that every period-related chart includes the requested period after export. Preserve chart style, titles, axes, and existing series order.
