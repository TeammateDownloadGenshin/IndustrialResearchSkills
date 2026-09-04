# Evidence Workpaper Workflow

This mode routes to the repository's canonical `evidence` workflow without copying its scripts or detailed schemas into this skill.

Create an XLSX workpaper that preserves each PDF/DOCX report block as an image on the left and places time-valid, non-broker evidence with clickable URLs on the right.

Before execution, read the canonical [evidence skill](../../../evidence/SKILL.md) and only the references it routes to. Scripts are under `../../../evidence/scripts/`. Use only bundled workspace dependency paths. Work in a conversation-specific output directory and never modify the input report.

Sequence: prepare report → inspect rendered pages → define semantic blocks → materialize blocks → research claims → capture eligible public evidence → review coverage → build workbook → render and inspect → validate.

The scripts can write inside the chosen output directory and invoke explicitly resolved LibreOffice/Poppler executables. They do not require API keys. Web capture uses Playwright on public pages only. Stop on access controls and mark unsupported material claims unresolved.
