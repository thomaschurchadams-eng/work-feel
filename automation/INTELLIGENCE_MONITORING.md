# Intelligence monitoring

The Alerts desk runs this monitoring layer during its existing scheduled checks. It does not create a separate automation.

## Each run

1. Read `automation/intelligence-sources.json`, monitoring state and the append-only signal ledger.
2. Check sources due for their cadence, prioritizing high-priority regulators, networks and credit-union technology providers.
3. Compare the newest attributable item with the source's prior fingerprint.
4. Normalize the owner, title, event date and canonical source URL; create a stable fingerprint.
5. Reject duplicates, unverifiable dates, generic marketing and signals without a credible credit-union implication.
6. Score accepted signals with `automation/intelligence-scoring.json`.
7. Route to no action, tracker-only, Alert, News or durable Insight.
8. Update vendor/regulatory records and public pages when evidence materially changes them.
9. Append accepted and rejected fingerprints with the decision reason, then update monitoring state.
10. Run `node scripts/validate-intelligence-monitoring.mjs` and `node scripts/validate-intelligence.mjs`.

Never rewrite or delete signal-ledger history during routine publishing. Redact no evidence: store only public titles, dates, URLs, classifications and decision reasons—never reader data or credentials.
