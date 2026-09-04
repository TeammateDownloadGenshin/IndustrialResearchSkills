---
name: industrial-research-skills
description: Conduct evidence-led healthcare industry, public-company, equity, and biomedical research; build reports, workpapers, claim-evidence maps, figures, catalyst trackers, and filing updates. Use only when explicitly invoked.
---

# IndustrialResearchSkills

Produce decision-useful research whose material claims remain traceable to time-valid sources. Separate reported facts, calculations, assumptions, interpretation, and scenarios.

## Invocation boundary

This skill is explicit-only. Do not apply it unless the user invokes `$industrial-research-skills` or selects it from the `/` skill menu. Invocation authorizes research and artifact creation requested in that turn; it does not authorize credentials, paid access, trading, publication, or external messages.

The bundled `industrial-research` MCP server is read-only. Use its workflow and provenance tools when local reference retrieval is useful. It does not browse the web, execute research scripts, or modify files.

## Route the request

- For an industry chain, thematic study, market map, company first pass, earnings review, competitive analysis, catalyst map, valuation, thesis red-team, or report draft, read [references/research-workflows.md](references/research-workflows.md).
- For biotech, biopharma, diagnostics, medtech, life-science tools, or healthcare services, also read [references/biomed-research.md](references/biomed-research.md).
- For a healthcare analyst deliverable such as an earnings note, deep-dive report, pipeline/asset review, MNC comparison, weekly report, or source-backed chart, read [references/analyst-workbench.md](references/analyst-workbench.md).
- Before accepting sources or writing consequential claims, read [references/source-policy.md](references/source-policy.md).
- For workspace inventory, version consolidation, duplicate review, or stale-evidence triage, read [references/workspace-curation.md](references/workspace-curation.md). Never move or delete files without explicit authorization.
- For an auditable side-by-side XLSX evidence package from a PDF/DOCX report, read [references/evidence-workpaper.md](references/evidence-workpaper.md) and its linked schemas.
- For rolling an A-share XLSX workpaper to a new official reporting period, read [references/sheet-update.md](references/sheet-update.md) and its linked schemas.
- For repository versions, licenses, exclusions, and local archive locations, read [references/upstream-provenance.md](references/upstream-provenance.md).

## Shared requirements

1. Define the research subject, decision, geography, time cutoff, reporting currency, forecast horizon, and requested deliverable. Ask only for a missing field that would materially change the result.
2. Build an evidence plan before broad searching. Prioritize primary sources and record publication dates, access dates, URLs, document titles, and relevant pages or sections.
3. Never invent financials, market shares, clinical milestones, trial results, regulatory status, transaction terms, consensus estimates, or citations. Mark unresolved claims explicitly.
4. Treat broker research, portals, social media, podcasts, newsletters, and AI summaries as leads or opinion—not primary proof. Do not use one research report to substantiate another.
5. Reconcile conflicting definitions, periods, units, currencies, scopes, trial populations, endpoints, and data cutoffs before comparison.
6. Use formulas or transparent calculations for derived values. Label assumptions and scenario variables. Do not present rule-based scores as validated probabilities.
7. Do not bypass authentication, paywalls, CAPTCHAs, robots restrictions, or rate limits. Do not use API keys unless the user explicitly authorizes them.
8. Preserve confidential inputs inside the user-approved workspace. Do not place proprietary text in logs, caches, public services, or external messages without authorization.
9. State limitations and distinguish evidence from inference. Investment-research output is analytical material, not personalized trading or position-sizing advice.

## Completion standard

Deliver the requested artifact plus a compact source ledger. For substantive reports, include the thesis, evidence, counter-evidence, key assumptions, catalysts, risks, unresolved questions, and a claim–evidence map. For biomedical work, include trial identifiers and data cutoffs wherever applicable. Every chart must retain its source data, transformation logic, units, cutoff, and editable or reproducible source.
