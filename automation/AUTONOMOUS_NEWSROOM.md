# Autonomous Newsroom Runbook

## Objective

Publish reliable, credible CreditUnionAI News coverage directly to production without routine human approval. Reliability takes priority over bundling unrelated newsroom work into one run.

## Operating model

The newsroom uses separate, single-purpose cycles:

1. **Article cycle** — publishes one full News or Insights article.
2. **Alert cycle** — publishes Alerts and maintains the ticker.
3. **Maintenance cycle** — handles archive migration, Intelligence maintenance, corrections, source health, newsletters and retention.

A cycle must not take ownership of another cycle's work. Do not combine article publishing, Alert publishing and maintenance in one scheduled run.

## Article cycle

1. Read only the files required for the article: `editorial-routing.json`, `editorial-taxonomy.json`, `publishing-rules.json`, `coverage-ledger.json`, `image-taxonomy.json`, `image-ledger.json`, `editorial-voice.md`, `analytics-measurement.json`, `seo-policy.json`, the relevant article template, the homepage, the correct section index, sitemaps and articles from the prior 14 days.
2. Search the prior 24–72 hours across at least four distinct beats and evaluate at least six credible candidates. Prefer primary documents and developments with a clear credit-union operating implication.
3. Select one candidate that clears all hard stops. If no current-event candidate qualifies, use the fallback order in `publishing-rules.json`: durable multi-source Insight, credit-union case study, then data-led explainer. Do not publish weak or unsupported material.
4. Route the article before drafting. Use News when the headline depends on a recent event; otherwise use Insights.
5. Produce one complete article package only: article, one passing 1200×630 image, metadata, byline, sources, internal links, correct section index, homepage placement, sitemaps, coverage ledger, image ledger, newsroom state, daily-cycle state and social queue when appropriate.
6. Run only the validators relevant to the article package, including analytics and SEO. Do not run unrelated Intelligence, corrections, retention, newsletter or archive-migration work.
7. Re-read `main` immediately before writing, preserve concurrent changes, commit the complete package directly to `main`, confirm the Vercel deployment is READY and verify the live article, image, listing and homepage.

## Alert cycle

1. Read the Alerts data/page, ticker implementation, homepage latest-alert module, coverage ledger, source registry, publishing rules and daily-cycle state.
2. The morning run may publish up to the number of Alerts still needed to reach the daily target of three. Later runs may publish at most one genuinely new breaking Alert.
3. Each Alert requires a factual headline, neutral summary, specific operational credit-union implication, date, source name and direct source URL.
4. Enforce exact one-to-one mapping between published Alerts and ticker items, newest-first order and the rolling 14-day window.
5. Update only the Alerts page/data, ticker, homepage latest-alert module, relevant ledgers and daily-cycle state. Do not create a full article, hero image, topic hub, Intelligence tracker update, correction audit or archive migration during an Alert cycle.
6. Re-read `main` immediately before writing, commit one atomic Alert package, confirm Vercel READY and verify the live Alerts page, ticker and homepage.

## Maintenance cycle

Maintenance work is separate from publishing. Growth review, source health, corrections, Intelligence, newsletters, legacy migration and retention each run in their own scheduled task or an explicitly scoped maintenance run. Maintenance failure must not block a valid article or Alert package.

## Concurrency and state

- Only one scheduled publisher should write at a time.
- Do not schedule article, Alert or feature publishers for the same start time.
- `daily-cycle-state.json` is a reporting ledger, not a lock. When the date changes, move the prior `current` object to `history` and initialize the new date before recording output.
- Re-read `main` immediately before every write. If another commit landed during the run, merge its current content rather than overwriting it.
- Use one commit per completed package. Do not create repeated scan-only commits when nothing publishes; record nonpublication in the scheduled-run result instead.

## Failure behavior

Continue to the next candidate after a rejection, but keep the scope bounded. An article cycle may stop after the six-candidate, four-beat pool and fallback formats are exhausted. An Alert cycle may stop when no qualifying Alert exists. Report the exact blocker for repeated failures, permission errors, validation failures or production breakage. Do not request routine editorial approval.

## Analytics and SEO

For every full article, add valid editorial analytics attributes and complete canonical, social, publication and JSON-LD metadata. Include at least two genuinely relevant internal article links. Update standard sitemaps and, for eligible News, the 48-hour news sitemap. Run `node scripts/validate-analytics.mjs <article-file>` and `node scripts/validate-seo-package.mjs <article-file>` as hard production gates.

## Weekly portfolio

Target five weekday article cycles plus differentiated Alerts. Additional deeper features may be restored only after the core article and Alert cycles demonstrate reliable production without overlap.
