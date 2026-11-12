# Autonomous Newsroom Runbook

## Objective

Publish reliable, credible CreditUnionAI News coverage directly to production without routine human approval. Reliability takes priority over bundling unrelated newsroom work into one run.

## Operating model

The newsroom uses separate, single-purpose cycles:

1. **Article cycle** — targets three distinct qualified News or Insights articles per weekday, maximum three, sequentially through the same Daily Publisher under publishing-rules.json. No schedule or weekend expansion.
2. **Alert cycle** — publishes Alerts and maintains the ticker.
3. **Maintenance cycle** — handles archive migration, Intelligence maintenance, corrections, source health, newsletters and retention.

A cycle must not take ownership of another cycle's work. Do not combine article publishing, Alert publishing and maintenance in one scheduled run.

For Alert quantity, cadence and task authority, `automation/scheduled-tasks/cuai-operating-system.md` is authoritative. This runbook must not introduce a quota or target that conflicts with that policy.

## Article cycle

1. Read only the files required for the article: `editorial-routing.json`, `editorial-taxonomy.json`, `publishing-rules.json`, `coverage-ledger.json`, `image-taxonomy.json`, `image-ledger.json`, `editorial-voice.md`, `analytics-measurement.json`, `seo-policy.json`, the relevant article template, the homepage, the correct section index, sitemaps and articles from the prior 14 days.
2. Search the prior 24–72 hours across at least six distinct beats and evaluate at least twelve credible candidates. Prefer primary documents and developments with a clear credit-union operating implication.
3. Select the strongest distinct candidate that clears all hard stops for each successive slot from the same bounded pool. If no current-event candidate qualifies, use the fallback order in `publishing-rules.json`: durable multi-source Insight, credit-union case study, then data-led explainer. Do not publish weak or unsupported material or expand research to force three stories.
4. Route the article before drafting. Use News when the headline depends on a recent event; otherwise use Insights.
5. Produce each complete article package sequentially: article, one passing 1200×630 image, metadata, byline, sources, internal links, correct section index, homepage placement, sitemaps, coverage ledger, image ledger and newsroom state. Leave daily-cycle state unchanged on the article branch; the same publisher persists canonical checkpoints and live closeout through the existing checkout-capable preservation path in its policy. Social selection follows actual live verification under the separate unchanged shared caps. Finish exact validation, actual visual review and production verification before starting the next package; an unresolved technical/permission block stops later packages under the same owner.
6. Run only the validators relevant to the article package, including analytics and SEO. Do not run unrelated Intelligence, corrections, retention, newsletter or archive-migration work.
7. Re-read `main` immediately before writing, preserve concurrent changes, submit the atomic package through the existing exact-head PR checks and authorized merge path, confirm the Vercel deployment is READY and verify the live article, image, listing and homepage. The same publisher then verifies its canonical closeout from a fresh checkout and exact stored blob; connector-only secondary whole-file finalization remains forbidden.
8. Every scheduled article cycle must leave one dated machine-observable outcome in `automation/daily-cycle-state.json`, preserving all earlier same-day publications and exact receipts. Record each unfilled slot and its actual reason using the structured admission rules in the publisher policy. Zero publications is valid only when no article has already been recorded that day. Preparation before CI uses an owned nonterminal `prepared` slot, then its real exact checkpoint; do not invent run IDs. Pending/failure ownership remains with the same daily publisher. This outcome-only state is reliability evidence, not editorial content.

## Alert cycle

1. Read the Alerts data/page, ticker implementation, homepage latest-alert module, coverage ledger, source registry, publishing rules, daily-cycle state and the authoritative CUAI Operating System policy.
2. Search for genuinely new, time-sensitive, qualified developments and publish at most one Alert per weekday. There is no Alert quota or minimum target; if nothing qualifies, record the no-Alert outcome and stop.
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
- Use one atomic content/coverage commit per article package. The same publisher separately persists canonical preparation, checkpoint, validated acceptance and verified live outcome through the executable two-ref protocol in its controlling policy; the article branch leaves daily-cycle state untouched. Do not create repeated scan-only content commits when nothing publishes. A single state-only commit recording a scheduled cycle's `no-article-published` or `blocked` outcome is required machine-observable reliability state and is not considered scan noise.

## Failure behavior

Continue to the next candidate after a rejection, but keep the scope bounded. An article cycle may stop after the twelve-candidate, six-beat pool and fallback formats are exhausted. When it stops without publication, persist the dated non-publication evidence in `daily-cycle-state.json` before completion. If a material blocker stops the article cycle after the policy is readable, persist the blocker there when GitHub remains writable. An Alert cycle may stop when no qualifying Alert exists. Report the exact blocker for repeated failures, permission errors, validation failures or production breakage. Do not request routine editorial approval.

If GitHub access itself prevents the required outcome write, report that exact GitHub failure instead of fabricating state.

## Analytics and SEO

For every full article, add valid editorial analytics attributes and complete canonical, social, publication and JSON-LD metadata. Include at least two genuinely relevant internal article links. Update standard sitemaps and, for eligible News, the 48-hour news sitemap. Run `node scripts/validate-analytics.mjs <article-file>` and `node scripts/validate-seo-package.mjs <article-file>` as hard production gates.

## Weekly portfolio

Target fifteen qualified articles across the existing five weekday cycles: three per weekday, maximum three. Follow the prospective November 9 cadence section and version 7 publishing rules. This is a target, not a guarantee or requirement to fill weak slots; the twelve-candidate pool, approved fallbacks, sourcing gates and existing usage remain bounded. Preserve earlier same-day outcomes and record held/unfilled slots; do not reopen completed cycles. Alerts remain separate with no quota; LinkedIn remains at one company post per weekday and five per week across all eligible article/media selections.
