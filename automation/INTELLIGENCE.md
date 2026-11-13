# Intelligence records

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

Use the separately scoped maintenance workflow in `INTELLIGENCE_MONITORING.md`; do not run article or Alert work here. Related coverage is optional: a verified primary-source tracker update does not require an article. Regenerate the two public trackers with `node scripts/generate-intelligence-pages.mjs`; its `--check` mode detects registry/page drift. Update only the Intelligence package. Run `node scripts/validate-intelligence.mjs` before publication and verify the live tracker records after deployment.

Production release: the Intelligence layer is validated in preview and deployed from `main`.

The monitoring backbone is defined in `automation/INTELLIGENCE_MONITORING.md`; its accepted public changes appear at `/intelligence/changes.html`.
