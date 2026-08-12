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

## GA4 reporting feed

The read-only endpoint `/api/ga4-metrics?commitSha=<CURRENT_PRODUCTION_COMMIT_SHA>` queries the Google Analytics Data API and returns privacy-safe aggregate 7-day and 28-day views for the CEO/growth loop.

It reports:

- site active users, new users, sessions, engaged sessions, engagement rate and page views;
- acquisition by session source, medium and campaign;
- LinkedIn sessions by `utm_content` using GA4's `sessionManualAdContent`, filtered to `linkedin / organic_social / cuai_news`;
- CUAI editorial event totals (`article_view`, `engaged_reader`, `scroll_depth`, `source_click`, `related_content_click`, `newsletter_intent`, `outbound_click`);
- page-level views, users, 90% scrolled users and engagement duration;
- Search Console landing-page metrics when the GA4 property has an active Search Console link and the requested fields are available.

The endpoint never returns service-account secrets, client IDs, user IDs, names, email addresses, form values or free-form reader input. It rejects requests that do not supply the exact deployed Git commit SHA.

### Required Vercel environment

The reporting endpoint requires:

- `GA4_PROPERTY_ID` — the numeric GA4 property ID (not the `G-...` measurement ID), and
- either `GA4_SERVICE_ACCOUNT_JSON`, or both `GA4_CLIENT_EMAIL` and `GA4_PRIVATE_KEY`.

The Google Cloud project behind the service account must have the Google Analytics Data API enabled. Add the service-account email to the CUAI GA4 property with read-only Viewer access. Keep credentials only in Vercel environment variables; never commit them to GitHub.

If configuration is absent, `/api/ga4-metrics` returns `ga4_reporting_not_configured` with only the missing configuration categories. If the service account lacks property access, it returns `ga4_property_access_denied`. The CEO must treat either result as a reporting blocker, never as zero traffic.

GA4's built-in `scrolledUsers` metric represents users reaching at least 90% of a page. CUAI already emits one privacy-safe `scroll_depth` event at 25%, 50%, 75% and 90% with the numeric event parameter `percent_scrolled`; no measurement-tag change is required.

For a reliable 50%-versus-90% Data API breakout, an Analytics administrator must make this non-destructive GA4 configuration change: **Admin → Data display → Custom definitions → Create custom dimension**; name it `Scroll depth percent`, choose event scope, and set the event parameter to `percent_scrolled`. After GA4 finishes processing the definition, query dimension `customEvent:percent_scrolled` with `eventName=scroll_depth` and metrics `activeUsers` and `eventCount`. Historical values collected before registration are not backfilled, so keep `scrolledUsers` as the historical 90% series and begin the comparable custom 50%/90% series from the registration date. This does not alter the `G-...` measurement tag, page behavior, schedules or editorial workflow.

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
