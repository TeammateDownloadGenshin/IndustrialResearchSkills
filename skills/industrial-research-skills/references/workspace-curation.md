# Research Workspace Curation

Use this mode only when the user asks to inventory, consolidate, archive, deduplicate, or assess freshness. Inventory is read-only by default. Never move, rename, overwrite, or delete files without explicit authorization and an exact target list.

## Audit first

Run `scripts/workspace_inventory.py <root> --out <inventory.json>` when a structured inventory helps. It uses the Python standard library, reads only common research artifacts, hashes files for exact-duplicate detection, and writes only the explicitly requested JSON output. Treat its role labels as triage hints, not final judgments.

Report separately:

1. primary and official sources;
2. workpapers and calculation models;
3. analysis notes and claim-evidence maps;
4. final deliverables;
5. QA renders and reproducibility scripts;
6. temporary, superseded, duplicate, and browser/profile artifacts.

## Recommended project structure

Apply to new projects immediately; migrate existing projects only after approval.

```text
company-or-theme/
  00_scope/
  01_sources/raw/
  01_sources/ledger/
  02_workpapers/
  03_analysis/
  04_deliverables/
  05_qa/
  90_archive/
  99_temp/
```

Keep one canonical copy of each downloaded source within a project and refer to it from evidence manifests instead of copying it into every capture or output directory. Preserve immutable raw sources; derived crops and screenshots belong in QA or evidence-output folders.

## Naming and version promotion

Use `YYYYMMDD_subject_artifact_status.ext` when a date matters. Use a small status vocabulary such as `draft`, `review`, and `published`; avoid chains such as `final-v2-new-copy`. Keep one current deliverable and move superseded versions to `90_archive/` with their date and reason. A hash match proves exact duplication, not which copy is canonical.

## Freshness ledger

Facts live in project evidence, not in this skill. For every reusable dataset or table record `as_of`, source publication date, access date, reporting period or clinical data cutoff, refresh trigger, and supersession status.

- Financials become superseded when a later official period, correction, or restatement changes the relevant comparison.
- Trial, pipeline, regulatory, partnership, and catalyst status must be refreshed for each new deliverable.
- Market share, price, capacity, policy, reimbursement, and competitive-position data require an explicit as-of date and definition check before reuse.
- Mechanism and foundational literature may remain useful longer, but corrections, retractions, later contradictory evidence, and modality-specific translation must still be checked.
- Templates and style guides control presentation only when they are the current team-approved version.

Label stale material `historical`, `superseded`, or `needs_refresh`; do not silently delete it or present it as current evidence.

## Consolidation plan

Produce a proposed manifest before any cleanup: current canonical file, duplicates, superseded versions, destination, reason, and recoverability. Prefer moving approved old versions to `90_archive/` over deletion. Keep reproducibility scripts only when they rebuild a retained artifact or enforce a material QA check; discard generated caches and interpreter bytecode from distributable skill packages.
