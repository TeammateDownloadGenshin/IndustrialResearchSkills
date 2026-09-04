# A-Share Workpaper Update

This mode routes to the repository's canonical `sheet_update` workflow without copying its scripts or detailed schemas into this skill.

Use only for rolling an existing A-share financial workpaper to `YYYYQ1`, `YYYYH1`, `YYYYQ3`, or `YYYYFY` from official exchange, CNINFO, periodic-report, or company IR documents. Never overwrite the input workbook.

Before execution, read the canonical [sheet-update skill](../../../sheet_update/SKILL.md) and only the references it routes to. Scripts are under `../../../sheet_update/scripts/`. Use bundled workspace dependencies only.

Sequence: inspect and render workbook → locate the official filing → verify the PDF → extract consolidated statements → create the update manifest → capture highlighted evidence → build a new workbook → inspect changed sheets and charts → validate.

Use cumulative subtraction only for income-statement and cash-flow single-quarter values. Balance-sheet values are period-end observations. Keep unreliable mappings blank and add an unresolved record.
