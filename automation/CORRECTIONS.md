# Trust, source health and corrections

CreditUnionAI News corrects attributable errors automatically and never silently rewrites substantive reporting.

## Daily checks

On the first Alerts run each day, inspect external evidence for articles published in the prior 30 days, accepted Intelligence changes and any high-traffic article identified by the weekly growth review. Record redirects, temporary failures, removal, contradiction and supersession. Missing access is not proof that a claim is false.

## Weekly checks

During Monday's Growth Review, check the complete published archive. Validate external source URLs, canonical URLs, internal links, structured publication dates, correction markup and consistency with vendor/regulatory records.

## Decision rules

- **Maintenance:** non-substantive formatting, accessibility or internal-navigation repair; no visible notice.
- **Update:** original reporting remains accurate but material context or status changed.
- **Correction:** a factual statement, attribution, date, number, organization or status was wrong or materially misleading.
- **Retraction:** the central premise cannot be supported or safely corrected.

Updates, corrections and retractions require a visible notice, `dateModified`, an append-only ledger entry and an update to `corrections.html`. Retractions preserve the URL with a prominent explanation and are removed from active listings; they are not silently deleted.

Run `node scripts/validate-corrections.mjs` before publication. Automatically publish qualifying fixes without approval and roll back if validation or production verification fails.
