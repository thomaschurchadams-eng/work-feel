# Legacy content migration

This ledger upgrades published archive pages without changing their URLs or rewriting their reporting.

## Run rules

- Process at most one pending article per Daily Edition run.
- Preserve the canonical URL and the article's editorial substance.
- Add analytics dimensions, article metadata, a staff byline, NewsArticle/Article schema, and useful internal links where missing.
- Run the news-package, analytics, and SEO validators before merging.
- Update `automation/legacy-migration.json` only after validation passes.
- Verify the production deployment and migrated URL after merge.
- If any check fails, leave the item pending and do not publish that migration.

`news/article-template.html` is excluded from the published archive. Keep it out of search indexes; do not treat it as an article.
