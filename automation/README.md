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

## Regular publication slot review

Run `node scripts/report-publisher-slots.mjs YYYY-MM-DD` from a current-main checkout. The read-only view joins current weekday targets, daily-cycle state and the coverage ledger; issue #160 remains the coordination evidence. It does not infer a deadline from the 7 a.m. start or count private expansion. A ledger link without a dated production check is not live proof.

The existing daily-publisher records `current.regularPublicationSlots` in the authoritative daily-cycle state when evidence is available. Each record identifies the slot, status (`live-verified`, `editorial-hold`, `technical-failure`, `pending-validation`, or `late-validation`), verified URL/time and production commit when applicable, next action and offset-qualified review time, and the existing issue/PR/run evidence. The history-preserving daily write carries the records forward with their date. Missing records remain unverified.

Before closeout, re-read the exact-head design job. If it is still pending, do not call it a failed test or write a closeout that conflicts with the candidate. Keep the same PR, head and run under the daily-publisher, record a concrete Eastern review time, and recheck before release or another closeout. A terminal technical failure or missed review goes through the existing issue #160 escalation path. A late pass applies only to that head; actual visual review and every release gate still apply. Recording proof and following up are manual unless an existing execution is observed doing them.
