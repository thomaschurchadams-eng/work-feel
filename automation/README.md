# Editorial Coverage Engine

This system combines an explicit coverage matrix with AI news judgment. It prevents the publication from drifting toward the same functions, technologies, formats, and angles while refusing to manufacture stories solely to fill an empty cell.

## Flow

1. Gather credible, public-source story candidates.
2. Normalize each candidate using `editorial-taxonomy.json`.
3. Score candidates with `scripts/score-editorial-candidates.mjs`.
4. Reject candidates that fail the hard stops in `publishing-rules.json`.
5. Publish the highest-scoring, balanced set automatically.
6. Append every production article to `coverage-ledger.json`.
7. Use the weekly analytics review to tune target shares, weights, formats, and timing.

## Candidate schema

```json
{
  "id": "stable-story-id",
  "title": "Proposed headline",
  "sourceUrl": "https://public-source.example/story",
  "sourcePublishedAt": "2026-07-18T12:00:00Z",
  "sourceTier": 1,
  "confidence": 0.92,
  "functions": ["lending-collections"],
  "technologies": ["data-decisioning"],
  "format": "reported-news",
  "maturity": "practical-now",
  "angles": ["results"],
  "audiences": ["functional-leader"],
  "institutionSize": "all",
  "newsworthiness": 82,
  "creditUnionRelevance": 90
}
```

Source tier 1 is an authoritative primary source. Tier 2 is a strong independent publication or directly attributable reporting. Tiers 3 and 4 do not qualify for automatic publication without stronger corroboration.

Run with:

```bash
node scripts/score-editorial-candidates.mjs candidates.json
```
