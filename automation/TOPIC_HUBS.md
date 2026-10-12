# Topic hubs

Topic hubs organize existing reporting across credit-union functions and technologies.

- Configuration: `automation/topic-hubs.json`
- Index: `topics.html`
- Generated pages: `topics/*.html`
- Validation: `node scripts/generate-topic-hubs.mjs`

Only publish a hub with at least four genuinely relevant articles. New publishing runs should add an article to every matching hub, regenerate affected pages, update both sitemaps, and validate the referenced article paths. Do not create thin pages merely to cover every taxonomy value.
