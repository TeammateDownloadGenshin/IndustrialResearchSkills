# IndustrialResearchSkills

`IndustrialResearchSkills` is a collection of Codex skills for industry-research workflows.

## Available sub-skills

The repository currently contains one sub-skill only:

- [`evidence`](evidence/SKILL.md) — evidence workpaper sourcing. It extracts semantic blocks and material claims from PDF or DOCX industry reports, searches for eligible primary evidence, captures the supporting passages, and assembles an auditable XLSX workpaper.

The `evidence` sub-skill rejects sell-side and brokerage research as supporting evidence, applies a report-date publication cutoff, and keeps unsupported claims visible as unresolved items.

## Examples

- [`example-evidence-guobang-20260706.xlsx`](examples/example-evidence-guobang-20260706.xlsx)
- [`example-evidence-innovative-drugs-2025-2026-mrna.xlsx`](examples/example-evidence-innovative-drugs-2025-2026-mrna.xlsx)

The example workbooks are read-only visual references. Their contents are preserved as originally supplied.

## Invocation

```text
Use $evidence to generate an evidence-backed XLSX workpaper from this PDF or DOCX industry report.
```

See [`evidence/SKILL.md`](evidence/SKILL.md) for the workflow, source restrictions, runtime boundaries, and completion criteria.
