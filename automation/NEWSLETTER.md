# Weekly briefing automation

Status: approved Friday 600–750-word sample-first format; implementation has not started. Prior task-creation attempts are not evidence of an active run. The steps below describe the intended editorial workflow after the sample is reviewed. Provider selection and sender/reply-to address approval are separate gates; no email sending is authorized by this document.

1. Read `automation/newsletter-rules.json`, the coverage ledger, recent News, Insights and Alerts, and `automation/newsletter-state.json`.
2. Select one lead story, three to five additional stories and two to four important alerts. Cover at least three credit-union functions and two technologies.
3. Synthesize the week; do not paste article summaries together.
4. Publish from `templates/newsletter-edition.html` at `/newsletter/YYYY-MM-DD.html`.
5. Add the edition newest-first between the archive markers in `newsletter.html`.
6. Update `sitemap.xml`, `sitemap.txt` and `automation/newsletter-state.json`.
7. Validate links, dates, sources, selection variety and HTML.
8. Publish the web edition even when no email provider is connected. Never say it was emailed or delivered unless the provider confirms it.

The live subscription action currently opens an email addressed to `info@creditunionainews.com`. This is an honest interim conversion path, not an automated subscriber database.
