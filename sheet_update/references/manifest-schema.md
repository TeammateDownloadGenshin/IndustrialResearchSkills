# Update Manifest Schema

Use UTF-8 JSON. Project keys and enum values are English; source titles and quotations may retain their original language.

```json
{
  "schema_version": "1.0",
  "input_workbook": { "path": "input.xlsx", "sha256": "..." },
  "company": { "name": "Issuer name", "stock_code": "603707" },
  "requested_period": "2026H1",
  "source_filings": [
    {
      "id": "SRC001",
      "source_type": "exchange",
      "title": "2026 Semi-annual Report",
      "publisher": "Shanghai Stock Exchange",
      "url": "https://...pdf",
      "published_date": "2026-08-28",
      "local_path": "filing.pdf",
      "sha256": "...",
      "is_correction": false
    }
  ],
  "raw_values": [
    {
      "id": "VAL001",
      "filing_id": "SRC001",
      "statement_type": "income_statement",
      "consolidation_scope": "consolidated",
      "metric": "revenue",
      "source_label": "Operating revenue",
      "period": "2026H1",
      "comparison_period": null,
      "value": 1926260932.67,
      "source_unit": "CNY",
      "target_unit": "CNY million",
      "conversion_factor": 0.000001,
      "pdf_page": 118,
      "evidence_ids": ["EV001"]
    }
  ],
  "clear_ranges": [
    { "sheet": "Quarterly", "range": "A22:U23", "apply_to": "contents" }
  ],
  "hidden_ranges": [
    { "sheet": "Quarterly", "range": "AG:AO", "hide": "columns" }
  ],
  "helper_sheets": [
    { "name": "__sheet_update_helpers", "visibility": "hidden" }
  ],
  "copy_ranges": [
    { "sheet": "Financials", "source": "D4:D20", "destination": "E4:E20", "copy_type": "all" }
  ],
  "updates": [
    {
      "id": "UPD001",
      "sheet": "Financials",
      "cell": "E7",
      "kind": "reported_value",
      "raw_value_id": "VAL001",
      "value": 1926.26093267,
      "number_format": "#,##0.0",
      "evidence_ids": ["EV001"]
    },
    {
      "id": "UPD002",
      "sheet": "Quarterly",
      "cell": "G7",
      "kind": "formula",
      "formula": "='Financials'!E7-'Financials'!D7",
      "evidence_ids": ["EV001"]
    }
  ],
  "chart_updates": [
    {
      "sheet": "Quarterly",
      "chart_index": 0,
      "series_index": 0,
      "category_formula": "='Quarterly'!$B$3:$G$3",
      "formula": "='Quarterly'!$B$7:$G$7"
      ,"name": "Revenue",
      "replace_series": true
    }
  ],
  "evidence": [
    {
      "id": "EV001",
      "filing_id": "SRC001",
      "pdf_page": 118,
      "screenshot_path": "captures/EV001.png",
      "supported_update_ids": ["UPD001", "UPD002"]
    }
  ],
  "unresolved": [
    { "sheet": "Financials", "cells": ["E12"], "metric": "Example metric", "reason": "Not disclosed", "search_scope": "Consolidated statements and notes" }
  ],
  "protected_sheets": ["ANDA"],
  "baseline_errors": []
}
```

Allowed `source_type` values are `exchange`, `cninfo`, `company_periodic_report`, and `company_ir`. Allowed `kind` values are `reported_value`, `formula`, and `label`. Allowed `statement_type` values are `income_statement`, `balance_sheet`, `cash_flow_statement`, `notes`, and `other_official_table`.

`clear_ranges` is optional. It is intended for moving or rebuilding a period table while preserving drawings and unrelated cells. `apply_to` defaults to `contents`. `hidden_ranges` may hide helper rows or columns used by chart sources. `helper_sheets` may add hidden, English-named calculation sheets for auditable chart sources; chart updates reference them with `data_sheet`. A chart update may also set a series `name`. Set `replace_series` to `true` when an imported chart type ignores direct series-formula assignment. Set `replace_chart` to `true` with `data_range` when an imported combo chart ignores all source updates; the builder preserves its anchor, then reconstructs a supported chart from the helper range.

Every `reported_value` update requires a `raw_value_id` and at least one evidence ID. Every evidence item requires a filing, PDF page, screenshot, and supported update IDs. Use one-based PDF page numbers.
