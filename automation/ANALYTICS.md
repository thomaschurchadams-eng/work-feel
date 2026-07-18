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

## Weekly growth review

Analyze:

- article views and engaged-reader rate;
- 50% and 90% scroll rates;
- source and related-content clicks;
- newsletter-intent rate;
- results by editorial function, technology, format, audience, maturity, section, landing page and acquisition source;
- Vercel visitors, page views, referrers and production health.

Recommend schedule or portfolio changes only when the sample is sufficient. Never send or report email addresses, names, form values, or free-form reader input.
