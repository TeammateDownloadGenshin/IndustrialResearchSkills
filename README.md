# IndustrialResearchSkills

`IndustrialResearchSkills` is an explicit-only Codex plugin for evidence-led healthcare industry, public-company, equity, and biomedical research.

It combines an analyst workflow router with two deterministic workpaper modules:

- healthcare earnings notes, company deep dives, biomedical asset/platform diligence, thematic research, MNC comparisons, catalyst reviews, weekly reports, and source-backed figure/document QA;
- [`evidence`](evidence/SKILL.md), which turns a PDF or DOCX report into an auditable side-by-side XLSX evidence workpaper;
- [`sheet_update`](sheet_update/SKILL.md), which rolls an A-share XLSX workpaper to a new official reporting period with formulas and filing evidence.

## Invocation

The combined skill does not run automatically. Select it from the `/` menu or invoke:

```text
$industrial-research-skills
```

The policy is fixed in [`agents/openai.yaml`](skills/industrial-research-skills/agents/openai.yaml) as `allow_implicit_invocation: false`.

## Repository layout

```text
.codex-plugin/plugin.json                 Plugin manifest
.mcp.json                                Read-only local MCP configuration
scripts/mcp_server.py                    Fixed-reference MCP server
skills/industrial-research-skills/       Combined skill and analyst workflows
evidence/                                Canonical evidence-workpaper module
sheet_update/                            Canonical A-share update module
examples/                                Legacy visual examples
```

The combined skill links to the canonical `evidence` and `sheet_update` modules rather than copying their scripts or schemas.

## Safety boundary

- The MCP server is local, read-only, standard-library-only, and exposes a fixed reference allowlist.
- No API key is required.
- Browser capture is limited to public evidence and must stop at authentication, paywalls, CAPTCHAs, robots restrictions, or rate limits.
- Research artifacts, outputs, rendered previews, browser profiles, caches, and interpreter bytecode are excluded from source control.
- Material claims must remain traceable to time-valid primary evidence; unresolved items stay visible.

See [`SECURITY_AUDIT.md`](SECURITY_AUDIT.md) and [`upstream-provenance.md`](skills/industrial-research-skills/references/upstream-provenance.md) for dependency, provenance, and exclusion decisions.

## Validation

The repository is validated with the Codex skill and plugin validators, Python compilation, module self-checks, and an MCP initialize/list/read smoke test before release.

The binary workbooks in `examples/` are retained only as legacy visual references. New tests should use small generated fixtures; do not add proprietary reports, filings, browser profiles, or large generated workbooks to the repository.
