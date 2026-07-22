# Analytics measurement

CreditUnionAI News uses GA4 measurement ID `G-RF6EFK06G5` and Vercel Web Analytics. The shared `assets/app.js` layer sends privacy-safe editorial events to GA4 when `gtag` is available.

## Publication requirements

Every new News or Insights article must put the six attributes defined in `automation/analytics-measurement.json` on its `body` element. Values must use IDs from `automation/editorial-taxonomy.json`.

Example:

```html
<body
  data-section="insights"
  data-editorial-function="operations"
  data-technology="agents-automation"
  data-content-format="checklist"
  data-audience="functional-leader"
  data-maturity="practical-now">
```

The tracker infers section and generic defaults for older articles, so existing pages continue to produce events. New articles must not rely on those defaults.

## LinkedIn distribution attribution

Every LinkedIn item must preserve the canonical article URL in `articleUrl` and create a separate `distributionUrl` with exactly these parameters:

- `utm_source=linkedin`
- `utm_medium=organic_social`
- `utm_campaign=cuai_news`
- `utm_content=<immutable social queue item id>`

The LinkedIn copy must use `distributionUrl`, not the untagged canonical URL. Do not add reader identifiers, names, email addresses, free-form text, or other personal data to campaign parameters.

The production scheduler at `/api/buffer-schedule-tracked` rejects queued items with missing, altered, or unapproved UTM parameters. The canonical page remains unchanged for SEO and internal linking.

## Buffer performance feed

The read-only production endpoint `/api/buffer-metrics` returns the prior 28 days of sent CreditUnionAI News LinkedIn posts, normalized Buffer metrics, metric freshness, ledger matching, and separate 7-day and 28-day summaries. It accepts only the exact current Vercel deployment commit and never returns the Buffer API key, account member data, names, email addresses, form values, or reader-level data.

Buffer refreshes post metrics approximately daily. A recent post with no metrics or a null `metricsUpdatedAt` is pending, not a zero-performance post.

## Weekly growth review

Analyze the full path:

1. LinkedIn impressions and reach;
2. reactions, comments, shares and engagement rate;
3. LinkedIn clicks and GA4 sessions attributed through the UTM values;
4. article views and engaged-reader rate;
5. 50% and 90% scroll rates;
6. source and related-content clicks;
7. newsletter-intent rate and return visits.

Compare results by editorial function, technology, format, audience, maturity, section, landing page, post format, publication weekday and posting time. Use the 7-day view for operating observations and the 28-day view for directional decisions. Do not change the publishing mix or schedule from one anomalous post; require a reasonable comparable sample or a repeated pattern.

Diagnostic rules:

- High impressions with weak clicks: improve the post hook, headline, visual treatment or relevance signal.
- Strong clicks with weak engaged reading: improve the article opening, promise alignment, structure or page experience.
- Strong reading depth with weak newsletter intent: improve the newsletter proposition and placement.
- Strong reactions but weak traffic: classify primarily as awareness rather than a traffic-winning format.
- Strong LinkedIn and onsite outcomes across comparable posts: increase production around the winning topic, audience and format while preserving editorial diversity.

Also review Vercel visitors, page views, referrers and production health. Recommend schedule or portfolio changes only when the sample is sufficient. Never send or report email addresses, names, form values, or free-form reader input.
