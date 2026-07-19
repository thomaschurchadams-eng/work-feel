# Automated intelligence layer

The Intelligence section turns verified public evidence into durable vendor and regulatory records.

## Files

- `automation/intelligence-schema.json`: required fields, evidence labels, routing and guardrails
- `automation/vendor-registry.json`: normalized vendor records and dated signals
- `automation/regulatory-watch.json`: normalized authority records and developments
- `scripts/validate-intelligence.mjs`: hard validation gate
- `intelligence/`: public tracker pages

## Publishing workflow

For every verified development, decide whether it warrants a tracker-only update, Alert, News article, Insight or recurring benchmark. One event may update a tracker and produce coverage, but do not publish repetitive versions of the same evidence.

Vendor marketing remains labeled `vendor-claim` until corroborated. Tracker inclusion is not endorsement. Regulatory summaries link to the primary authority and are not legal advice.

Update the registries, affected public pages and related topic hubs in the same production package. Run `node scripts/validate-intelligence.mjs` before publication and verify the live tracker records after deployment.
