# Evidence Source Policy

## Publication cutoff

Evidence must have been publicly available on or before the report date. Use this date precedence for the report:

1. Explicit date on the cover or in the report body.
2. Reliable document metadata.
3. A date encoded in the filename.
4. File modification date, marked as a fallback.

Reject a source with a publication date after the cutoff. If a source has no reliable publication date, use it only when the page itself or an archived official document establishes that it existed by the cutoff.

## Source priority

Use the highest available source in this order:

1. Regulator, exchange, government, court, or statutory filing.
2. Company filing, investor-relations page, official website, or official document.
3. Original registry, database, standard-setting body, or industry association.
4. Reputable news organization or original press release distribution.

Prefer the original document over an article that quotes it. Use multiple sources when one source does not cover all material parts of a claim.

## Prohibited evidence

Never accept the following as evidence:

- Sell-side research reports.
- Brokerage or securities-research reports.
- Investment-bank research.
- Analyst initiation, rating, target-price, or recommendation documents.
- Another industry research report that merely repeats the claim.
- Search-result snippets without an accessible underlying source.
- AI-generated summaries, uncited aggregations, or unverifiable reposts.

An official filing or corporate disclosure remains eligible when the subject company is itself a securities or financial-services company. Classify the document by its role, not only by the publisher's industry.

## Access restrictions

- Do not bypass authentication, subscription controls, paywalls, CAPTCHAs, robots restrictions, or rate limits.
- When a page is blocked, search for an official filing, public PDF, exchange copy, press-release copy, or another eligible original source.
- Record the failed URL and failure reason when no eligible public alternative exists.

## Direct support standard

A capture supports a claim only when the visible text, table, or figure contains the relevant fact. A page title or broad company description is insufficient when the claim concerns a specific value, date, product, or event.

Use these support levels:

- `direct`: the capture visibly states the claim or its underlying value.
- `partial`: the capture supports only part of the claim.
- `derived`: the capture provides the inputs for a transparent calculation recorded in the evidence note.

Do not use `contextual` material as the only evidence for a material claim.

## Unresolved claims

Keep every unresolved material claim in the manifest and workbook. Record:

- The claim ID and text.
- Search queries or source categories attempted.
- URLs that failed because of access restrictions.
- The reason no eligible source was accepted.

Never substitute a prohibited report merely to avoid an unresolved status.
