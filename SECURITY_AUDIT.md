# IndustrialResearchSkills Security and Dependency Review

Review date: 2026-09-04

## Scope and result

The combined skill was assembled from pinned reviews without API keys. It routes to this repository's existing evidence-workpaper and sheet-update workflows instead of duplicating their scripts and detailed schemas.

Overall rating: **low risk for the core skill and MCP server; medium, user-triggered risk for browser capture and workbook-generation scripts.**

## MCP server

`scripts/mcp_server.py` uses only the Python standard library and stdio JSON-RPC. It exposes three read-only tools and eight fixed Markdown resources. It has no network code, shell execution, arbitrary-path input, persistence, telemetry, secrets, or logging.

The optional `workspace_inventory.py` helper also uses only the Python standard library. It reads user-selected research files, calculates SHA-256 hashes, and writes JSON only when the caller supplies `--out`. It performs no network requests, deletion, renaming, shell execution, credential access, or automatic cleanup.

Smoke-tested methods:

- `initialize`
- `tools/list`
- `tools/call`
- `resources/list`
- `resources/read`

## Skill invocation

`skills/industrial-research-skills/agents/openai.yaml` sets:

```yaml
policy:
  allow_implicit_invocation: false
```

The skill therefore requires explicit selection from the `/` menu or `$industrial-research-skills` invocation.

## Runtime dependencies

The core research skill and MCP server require no third-party package installation.

The optional evidence-workpaper and sheet-update scripts use Codex bundled workspace dependencies:

- Python: `pdfplumber`, `Pillow`, `pypdf`;
- Node.js: `@oai/artifact-tool`, `sharp`, `playwright`;
- native tools: Poppler `pdftoppm`; LibreOffice for DOCX conversion when needed.

All listed modules and native tools were resolved successfully in the current workspace runtime. No package manager is invoked by the plugin.

PyYAML 6.0.3 was installed only under the marketplace's `.validation-deps` directory to run the official skill/plugin validators. It is not referenced by or required at plugin runtime.

## Script behavior

The repository's optional workflow scripts can write to user-selected work/output directories. Some invoke explicitly resolved `pdftoppm` or LibreOffice commands without a shell. Browser capture uses Playwright for public HTML/PDF evidence. The scripts do not request API keys.

Residual controls:

- use a conversation-specific output directory;
- never overwrite input reports or workbooks;
- inspect every URL and downloaded filing;
- do not use browser capture on authenticated/private sessions;
- stop at CAPTCHAs, paywalls, authentication, robots restrictions, or repeated navigation failures;
- review generated screenshots and workbooks before relying on them.

## Exclusions

The plugin excludes high-risk or unnecessary components: `deep-research-machine`, WeChat/CDP automation, Tushare/token paths, proxy-clearing scripts, social/news scanning, technical-analysis automation, YouTube transcript downloading, email integrations, and prebuilt `.skill` bundles.

LaTour materials remain outside the plugin in a reference-only local archive because no root license was found.

## Validation evidence

- Skill validator: passed.
- Plugin validator: passed.
- Python compilation: passed for all seven in-scope Python files.
- Node syntax check: passed for all eleven in-scope `.mjs` files.
- MCP handshake/tool/resource smoke test: passed.
- Evidence browser-capture smoke test: passed with five local fixture captures.
- A-share period-semantics test: passed with four cases.

See `skills/industrial-research-skills/references/upstream-provenance.md` and `THIRD_PARTY_NOTICES.md` for pinned commits and licensing.
