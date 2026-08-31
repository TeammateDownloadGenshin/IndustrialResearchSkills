# Semantic Segmentation

## Goal

Create reviewable blocks that match how an analyst would substantiate a report. A block must be small enough to have a coherent evidence set and large enough to retain the context needed to interpret its claims.

## Block rules

1. Keep a figure or table with its title, caption, source note, footnotes, and immediately adjacent explanatory paragraphs.
2. End a figure or table block before the next heading, figure, table, or clearly independent argument.
3. Group pure prose under the same heading in sets of two to four consecutive paragraphs. Use fewer paragraphs when one paragraph contains a standalone material claim.
4. Keep a multi-page table in one block. Use multiple source images when one crop cannot preserve the headers and all relevant rows.
5. Keep a continuous figure group together only when the figures share one caption, legend, or analytical claim.
6. Do not split a list, table row group, caption, footnote set, or calculation explanation across blocks.
7. Exclude covers, disclaimers, tables of contents, blank pages, and boilerplate unless they contain a material claim that requires evidence.

## Block types

- `figure`: chart, diagram, illustration, or image-led unit.
- `table`: tabular unit, including a table that spans pages.
- `text`: prose-only unit.
- `mixed`: a figure or table plus substantial explanatory prose.

## Crop guidance

- Prefer pixel coordinates from the rendered page image.
- Include enough margin to preserve the heading, caption, units, legend, source note, and paragraph boundaries.
- Avoid including unrelated neighboring blocks.
- Use a full-page crop when a page is one coherent block or when layout cannot be separated reliably.
- For image-only pages, inspect the rendered page visually and set crops manually in the block plan.

## Claim extraction

Create claims after segmentation. A material claim is a factual statement that affects the report's analysis and can be checked against an external source. Examples include financial values, dates, capacities, product status, regulatory events, market size, ownership, contracts, clinical milestones, and quoted management guidance.

Do not create separate claims for headings, rhetorical statements, opinions, or conclusions that contain no independently verifiable fact.

## Quality checks

- Every block has at least one source image.
- Every material sentence belongs to exactly one block.
- Block page references match the rendered report.
- Crop coordinates remain inside their source page.
- Block IDs are stable and sequential: `B001`, `B002`, and so on.
