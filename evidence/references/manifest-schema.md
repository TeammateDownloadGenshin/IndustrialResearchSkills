# Manifest Schema

## Report preparation output

`prepare_report.py` writes `report.json` with this shape:

```json
{
  "schema_version": "1.0",
  "report": {
    "input_path": "absolute path",
    "input_filename": "report.pdf",
    "input_type": "pdf",
    "title": "Report title",
    "report_date": "2026-06-30",
    "report_date_source": "document_text",
    "report_date_is_fallback": false,
    "sha256": "hex digest",
    "page_count": 12
  },
  "pages": [
    {
      "page": 1,
      "image_path": "absolute path",
      "width_points": 595.0,
      "height_points": 842.0,
      "width_pixels": 1818,
      "height_pixels": 2573,
      "text": "Extracted text",
      "text_length": 1400,
      "vision_required": false,
      "words": []
    }
  ],
  "docx_structure": null,
  "contact_sheets": []
}
```

Use `prepare_report.py <input> --work-dir <directory> --report-date YYYY-MM-DD` only when the date is visibly confirmed on an image-only cover or body page. The resulting `report_date_source` is `document_visual_text` and is not a fallback.

## Block plan

The agent writes `blocks.json`:

```json
{
  "schema_version": "1.0",
  "labels": {},
  "blocks": [
    {
      "id": "B001",
      "topic": "Company development history",
      "type": "mixed",
      "pages": [1],
      "crops": [
        {
          "page": 1,
          "coordinate_space": "pixels",
          "x": 50,
          "y": 120,
          "width": 1700,
          "height": 900
        }
      ],
      "claims": [
        {
          "id": "C001",
          "text": "The company was founded in 1996.",
          "material": true
        }
      ]
    }
  ]
}
```

`coordinate_space` may be `pixels`, `points`, or `normalized`. A block without crops uses its full referenced pages.

## Evidence manifest

`materialize_blocks.py` writes the initial `evidence.json`. After research and capture review, each block must contain:

```json
{
  "id": "B001",
  "sheet_name": "B001_Company history",
  "topic": "Company development history",
  "type": "mixed",
  "pages": [1],
  "source_images": ["absolute path"],
  "claims": [
    {
      "id": "C001",
      "text": "The company was founded in 1996.",
      "material": true,
      "status": "covered"
    }
  ],
  "evidence": [
    {
      "id": "E001",
      "claim_ids": ["C001"],
      "source_type": "company_website",
      "support_level": "direct",
      "title": "Company profile",
      "publisher": "Example Company",
      "url": "https://example.com/profile",
      "published_date": "2026-01-15",
      "accessed_at": "2026-06-30T12:00:00Z",
      "screenshot_path": "absolute path",
      "page_number": null,
      "note": "The highlighted sentence states the founding year."
    }
  ],
  "coverage_status": "covered",
  "unresolved": []
}
```

Allowed coverage values are `pending`, `covered`, `partial`, and `unresolved`.

Allowed source types are `regulator`, `exchange`, `government`, `statutory_filing`, `company_filing`, `company_website`, `original_database`, `registry`, `industry_association`, `reputable_news`, `press_release`, `official_pdf`, and `other_primary`.

Allowed support levels are `direct`, `partial`, and `derived`.

## Capture plan

`capture_web.mjs` accepts:

```json
{
  "schema_version": "1.0",
  "report_date": "2026-06-30",
  "items": [
    {
      "id": "E001",
      "block_id": "B001",
      "claim_ids": ["C001"],
      "url": "https://example.com/profile",
      "kind": "html",
      "source_type": "company_website",
      "title": "Company profile",
      "publisher": "Example Company",
      "published_date": "2026-01-15",
      "selector": null,
      "quotes": ["founded in 1996"],
      "context_padding": 80,
      "navigation_timeout_ms": 45000
    }
  ]
}
```

For `kind: "pdf"`, provide `page_number` and optionally a pixel crop with `x`, `y`, `width`, and `height`. Capture results include status, final URL, screenshot path, and an English error message when capture fails.

HTML capture results also record `match_methods`, `capture_method`, `dismissed_consent_count`, and an optional `support_warning`. Normalized DOM matching can locate quotations split across nested elements or irregular whitespace. Distinctive product, phase, conference, and numeric anchors may recover a passage when the planned quotation uses a different language. A title-context fallback always carries `support_warning` and requires manual review. A remaining consent layer that overlaps the supporting passage returns `obstructed_overlay` instead of producing a misleading screenshot.

`navigation_timeout_ms` is optional for HTML captures and is bounded to 100-60,000 milliseconds. A match inside a table cell is expanded to its containing row before highlighting and capture.

If Playwright's managed browser is unavailable, pass `--browser-executable <path>` or set `PLAYWRIGHT_BROWSER_PATH`. On Windows, the script also checks standard Chrome and Edge installation locations.

## Optional labels

The top-level `labels` object may override workbook-facing text. Missing values fall back to English. Schema keys, enum values, logs, and validation messages must not be localized.
