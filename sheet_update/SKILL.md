---
name: sheet-update
description: Update an A-share financial workpaper XLSX to a user-specified reporting period using official periodic filings, auditable formulas, and filing screenshots. Use for quarterly, half-year, third-quarter, or annual workbook roll-forwards; do not use for general spreadsheet editing or third-party data refreshes.
---

# Sheet Update

Update a historical A-share financial workpaper without overwriting the input workbook. Treat the user's requested period as authoritative and preserve its semantics: `YYYYQ1`, `YYYYH1`, `YYYYQ3`, or `YYYYFY`.

## Required workflow

1. Confirm that the company, stock code, input workbook, and requested period are uniquely identifiable. Stop only if one remains ambiguous or the required official filing is unavailable or corrupt.
2. Run `scripts/inspect_workbook.mjs` and review every rendered sheet before mapping changes. Identify all period-dependent sheets, formulas, formats, conditional formatting, images, and charts. Mark non-period sheets as protected.
3. Read [period-semantics.md](references/period-semantics.md) before deriving a single-quarter value. Read [source-policy.md](references/source-policy.md) before searching for or accepting a filing.
4. Search official exchange, CNINFO, or company investor-relations sources. Prefer the latest official corrected or restated filing for the requested period. Use `scripts/fetch_filing.mjs` for browser-based public PDF retrieval and `scripts/prepare_filing.py` for text and page preparation.
5. Extract consolidated financial statements where available. Disambiguate repeated labels with the statement type, table heading, period columns, consolidation scope, and unit. Never map by row label alone.
6. Create an update manifest that follows [manifest-schema.md](references/manifest-schema.md). Record every reported value, unit conversion, target cell, formula, chart extension, evidence screenshot, and unresolved item.
7. Use `scripts/capture_filing.mjs` to crop the smallest readable PDF region and add pale-yellow highlights with red outlines around the supporting rows. Do not use a full-page screenshot when a readable local crop is possible.
8. Run `scripts/build_update.mjs`. Directly disclosed values must be numeric cells with source comments. Derived totals, ratios, growth rates, and single-quarter values must be auditable formulas. Place filing cards below existing tables and drawings on each changed sheet.
9. Run `scripts/validate_update.py`, inspect key formulas and every changed-sheet render, and fix clipping, overlap, broken links, chart omissions, unit mismatches, or new formula errors before delivery.

## Non-negotiable constraints

- Accept only official exchange, CNINFO, periodic-report, or company IR documents for newly entered financial data. Preserve existing third-party material but never use it to fill the new period.
- Do not bypass CAPTCHAs, logins, paywalls, robots restrictions, or access controls.
- Use `H1`, never `Q2`, for the cumulative half-year column. A separate single-quarter series may use a formula-derived `Q2`.
- Income-statement and cash-flow single-quarter values use cumulative subtraction. Balance-sheet values are period-end point-in-time values and are never quarter-subtracted.
- Leave unavailable or unreliable mappings blank and add a red unresolved panel. Never guess, carry forward, or silently replace a value.
- Preserve non-period sheets, existing drawings, workbook order, formatting conventions, and any pre-existing formula-error baseline. Do not introduce proprietary external functions or new formula errors.
- Save `<input-stem>-updated-<requested-period>.xlsx` in a separate run directory.

## Script interfaces

```text
inspect_workbook.mjs --input <xlsx> --output <workbook-map.json> --preview-dir <dir>
fetch_filing.mjs --url <official-url> --output <filing.pdf>
prepare_filing.py <filing.pdf> --work-dir <dir>
capture_filing.mjs --plan <capture-plan.json> --output-dir <dir>
build_update.mjs --input <xlsx> --manifest <update.json> --output <xlsx> --preview-dir <dir>
validate_update.py --manifest <update.json> --workbook <xlsx>
```

Read [workbook-update.md](references/workbook-update.md) when planning column insertion, formula propagation, chart expansion, or evidence-card placement.
