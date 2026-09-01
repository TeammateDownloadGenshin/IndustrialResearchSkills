# IndustrialResearchSkills

`IndustrialResearchSkills` is a collection of Codex skills for industry-research workflows.

## Available sub-skills

The repository currently contains two sub-skills:

- [`evidence`](evidence/SKILL.md) — evidence workpaper sourcing. It extracts semantic blocks and material claims from PDF or DOCX industry reports, searches for eligible primary evidence, captures the supporting passages, and assembles an auditable XLSX workpaper.
- [`sheet-update`](sheet_update/SKILL.md) — A-share financial workpaper updating. It rolls an existing XLSX forward to a user-specified reporting period using official periodic filings, auditable formulas, and filing evidence screenshots placed below each updated sheet.

The `evidence` sub-skill rejects sell-side and brokerage research as supporting evidence, applies a report-date publication cutoff, and keeps unsupported claims visible as unresolved items.

## Examples

Evidence workpapers:

- [`example-evidence-guobang-20260706.xlsx`](examples/example-evidence-guobang-20260706.xlsx)
- [`example-evidence-innovative-drugs-2025-2026-mrna.xlsx`](examples/example-evidence-innovative-drugs-2025-2026-mrna.xlsx)

Sheet-update workpapers:

- [`example-jianyou-2025-2026q1-workpaper.xlsx`](examples/example-jianyou-2025-2026q1-workpaper.xlsx)
- [`example-jianyou-2026h1-updated-workpaper.xlsx`](examples/example-jianyou-2026h1-updated-workpaper.xlsx)

The example workbooks are read-only visual references. Their contents are preserved as originally supplied.

## Invocation

```text
Use $evidence to generate an evidence-backed XLSX workpaper from this PDF or DOCX industry report.

Use $sheet-update to update this A-share XLSX workpaper to 2026H1 using official periodic filings and evidence screenshots.
```

See each sub-skill's `SKILL.md` for its workflow, source restrictions, runtime boundaries, and completion criteria.
