---
name: evidence
description: Create evidence-backed XLSX workpapers from PDF or DOCX industry research reports by rendering semantic report blocks, finding time-valid non-broker evidence, capturing supporting passages, and assembling auditable side-by-side sheets. Use for industry-research evidence files, claim-verification workbooks, source workpapers, and audit-ready support packages.
---

# Evidence Workpaper Skill

Create an XLSX workpaper that preserves each report block as an image on the left and places supporting source captures with clickable URLs on the right.

## Non-negotiable rules

- Preserve the original language in report and source screenshots.
- Use sources that were public no later than the report date.
- Prefer primary and official evidence. Never use sell-side, brokerage, securities-research, or investment-bank research reports as evidence.
- Do not bypass logins, paywalls, CAPTCHAs, robots restrictions, or other access controls.
- Keep unsupported material claims visible and mark them unresolved in red. Never silently omit or downgrade them to a prohibited source.
- Keep project instructions, code, logs, schema keys, and validation messages in English.

## Required references

Read these files before running the corresponding stage:

- Read [references/segmentation.md](references/segmentation.md) before creating semantic blocks.
- Read [references/source-policy.md](references/source-policy.md) before researching or accepting evidence.
- Read [references/manifest-schema.md](references/manifest-schema.md) before writing block, capture, or evidence manifests.
- Read [references/workbook-layout.md](references/workbook-layout.md) before building or reviewing the workbook.

## Workflow

1. Load the bundled workspace dependencies. Use only the returned Python, Node.js, Node module, Poppler, LibreOffice, Playwright, and Artifact Tool paths.
2. Run `prepare_report.py <input> --work-dir <directory>`. Inspect every rendered report page or the generated contact sheets. The script does not perform OCR; pages marked `vision_required` require visual reading. Confirm the report date before research. If an image-only cover or body shows an explicit date that the text layer could not expose, rerun with `--report-date YYYY-MM-DD`; do not use this override for an inferred date.
3. Create `blocks.json` from the rendered pages and extracted structure. Apply the semantic boundaries in `segmentation.md`, then run `materialize_blocks.py --report <report.json> --plan <blocks.json>`.
4. Extract material, verifiable claims from every block. Search claim by claim and apply `source-policy.md`. Record the search outcome even when no eligible source exists.
5. Create `capture-plan.json`. Use short exact quotations in the language actually served by the page when possible. Run `capture_web.mjs --plan <capture-plan.json> --output-dir <directory>` for eligible HTML pages or public PDFs. Review every capture. A capture is not evidence unless the highlighted content directly supports its mapped claim. The capture helper may reject or close ordinary cookie-consent banners, but it must not bypass access controls. Treat `obstructed_overlay` as a failed capture and seek another eligible official source. A result with `support_warning` is context only until manual review confirms direct support.
6. Add reviewed capture results to `evidence.json`. Mark each material claim `covered`, `partial`, or `unresolved`.
7. Immediately before the first workbook-authoring command, run the bundled `mark_artifact_operation_started.mjs` once with operation kind `create`, expected output count `1`, and output format `xlsx`.
8. Run `build_workbook.mjs --manifest <evidence.json> --output <workbook.xlsx> --preview-dir <directory>`. The script requires `CODEX_NODE_MODULES` to point to the loader-provided Node module directory.
9. Inspect key workbook ranges and every rendered sheet. Fix clipping, overlap, unreadable captures, misplaced links, or inconsistent coverage labels.
10. Run `validate_run.py --manifest <evidence.json> --workbook <workbook.xlsx>`. Deliver the XLSX only after validation passes or every remaining warning is explicitly disclosed.

## Runtime boundaries

- Work in a conversation-specific temporary or output directory. Do not modify the input report.
- Use Playwright only for public pages. Stop after one retry when navigation or matching fails in the same way.
- Do not use API keys unless the user explicitly authorizes them.
- Do not install alternate spreadsheet libraries. Workbook authoring must use `@oai/artifact-tool`.
- If the report date remains ambiguous after the documented precedence rules, stop and request the date instead of weakening the cutoff.

## Completion criteria

- The index lists every semantic block and its coverage status.
- Every material claim is mapped to eligible evidence or an unresolved reason.
- Every evidence card shows source metadata, a full clickable URL, and a readable supporting capture.
- Every evidence sheet contains the original capture at left, a red divider, and evidence at right.
- The workbook has no broken references, duplicate sheet names, missing images, or prohibited sources.
