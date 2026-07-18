# SEO and Google News publishing

Every full article must follow `automation/seo-policy.json`.

## News versus Insights

- News uses `NewsArticle` structured data and a canonical URL under `/news/`.
- Insights uses `Article` structured data and a canonical URL beginning `/insight-`.
- Both require complete Open Graph, Twitter, publication/modified dates, author, publisher, image, section and keyword signals.

## Google News sitemap

`news-sitemap.xml` contains only News articles published within the prior 48 hours. Remove older entries on every publication run. Insights never enter the Google News sitemap. All indexable pages and articles remain in `sitemap.xml` and `sitemap.txt`.

Each News entry must contain:

- canonical `loc`;
- publication name `CreditUnionAI News`;
- publication language `en`;
- ISO publication date;
- the exact article headline.

## Internal linking

Every article includes at least two relevant internal article links: ideally one sharing its primary credit-union function and one sharing its technology. Use the coverage ledger and current articles to select them. Links must help the reader; do not add unrelated links to satisfy a number.

## Validation

Run both:

```bash
node scripts/validate-news-package.mjs <article.html>
node scripts/validate-analytics.mjs <article.html>
node scripts/validate-seo-package.mjs <article.html>
```

The SEO validator checks canonical routing, metadata, structured data, dates, image URL, source links and related internal coverage. New News must also be added to `news-sitemap.xml` while it is within the 48-hour eligibility window.
