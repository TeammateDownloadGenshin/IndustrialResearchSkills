# Upstream Provenance and Security Decisions

The combined methodology was reviewed against the pinned snapshots below. No external repository source tree, prebuilt skill bundle, credentialed connector, or high-risk executor is redistributed here.

| Project | Pinned commit | License | Use in combined skill |
|---|---|---|---|
| [HHFinAi/claude-equity-research-skills](https://github.com/HHFinAi/claude-equity-research-skills) | `6e7ceef3c65287b7b88436fb4876f541b592a2ed` | MIT | Independently synthesized earnings, competition, thematic, report-reading, and supply-chain concepts; no scoring script bundled |
| [latour-ai/skills](https://github.com/latour-ai/skills) | `955bf2144abbd2af64f722964a2e352d59a49ea5` | No root license found at review | Reference-only local archive; ideas independently summarized; no source text or script bundled |
| [Haochenhust/ch-skills](https://github.com/Haochenhust/ch-skills) | `e11f709828946a136efeceb75b392e4c88c72c34` | MIT | Independently synthesized static industry/company/valuation/catalyst concepts |
| [bingofreedom/company-investment-research-skill](https://github.com/bingofreedom/company-investment-research-skill) | `02c70a948c2bcf4c229781ae62dfdee80d7ec179` | MIT | Independently synthesized generic research and quality-control concepts |
| [TeammateDownloadGenshin/IndustrialResearchSkills](https://github.com/TeammateDownloadGenshin/IndustrialResearchSkills) | `6afc454dc3bacce97bd6afd79a679a8f65b926c0` | MIT | Canonical evidence-workpaper and A-share update workflows retained and routed from the combined skill |

Excluded from the plugin:

- `deep-research-machine`, because it bypasses permissions, handles multiple secrets, and persists sensitive tool data;
- `ch-skills/wechat-feeds`, Tushare paths, proxy-clearing data scripts, social/news scanning, and technical-analysis automation;
- LaTour's YouTube transcript downloader, email/relationship workflows, and prebuilt `.skill` bundles;
- rule-based earnings scores presented as investment probabilities.

The local MCP server exposes only fixed bundled reference names. It performs no network calls, accepts no arbitrary path, runs no shell command, stores no data, and writes no logs.
