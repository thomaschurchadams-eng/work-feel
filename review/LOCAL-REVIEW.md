# CUAI local review — September 30, 2026

Prepared in isolated clone and local branch `review/cuai-audience-search-2026-09-30` from refreshed `origin/main` `822bae2`. Repository inspection found no tracked AGENTS.md or .agents/skills on this base. Production history is retained. No push, PR, merge, deployment, provider calls, publishing, automation edits or external mail setup occurred.

## Patch

- Home, News, Topics and About describe the existing broad industry coverage for credit-union leaders AND fintechs, core providers, payments companies, AI vendors and consultants serving them. Brand/domain and article URLs stay intact.
- Topics is visible in navigation on these entry pages and generated hubs. Three new paths have four verified existing articles each: Payments & Digital Money; Core Technology & Digital Banking; Vendors & Partners. Thirteen total hubs, 73 placements, shared accessible navigation and related industry paths. New URLs added to both sitemaps.
- Newsletter URL remains the return point for web briefings, with the already published September 28 CUAI Weekly episode, its reporting period, sources and transcript. Homepage and shared article return CTA remove the unsupported Friday delivery promise. Existing mailto remains a manual request; copy explicitly says the site pipeline is disconnected and no enrollment or delivery schedule is guaranteed. No email edition is fabricated.
- Search Console adds bounded query and query/page detail to both existing windows, with availability/limits/finalized-data evidence, contact-like query suppression and optional failure isolation. Authentication, exact-commit checks, credentials, readonly scope, aggregate/page fields and security gates remain intact.

## Seven-day review plan, October 1–7

The aim is to have a reviewable package within 48 hours (October 1–2), subject to review and test findings; this is not a delivery guarantee.

| Date | Work and decision |
| --- | --- |
| Oct 1 | Review audience wording and populated industry paths against existing coverage; assess local desktop/mobile navigation. |
| Oct 2 | Review reporting fixtures, compatibility, privacy and delay/limits disclosures; aim to complete the local review package. |
| Oct 3 | Collect Tom's edits to positioning and briefing return path; do not add provider setup or email promises. |
| Oct 4 | Review search-to-editorial guidance against existing rules and 8-article/week cadence; keep scheduling unchanged. |
| Oct 5 | Incorporate approved review edits locally and rerun only affected checks. Advertising assessment remains separate. |
| Oct 6 | Recheck current main changes and production-history/security gate compatibility before any later promotion proposal. |
| Oct 7 | Present final review decision: accept locally, revise, or defer. Any push/PR/deployment/merge requires separate authorization. |

## Review decisions

1. Accept the broader ecosystem wording while retaining CreditUnionAI News branding?
2. Accept three populated industry paths alongside existing AI/function paths?
3. Accept the existing newsletter URL as a web briefing return point with honest manual email status?
4. Accept bounded internal query text reporting with redaction and incomplete-data disclosures? Remaining privacy risk: automated detection cannot identify all sensitive query text.

Advertising prices, placements and contract claims were not changed; parent is assessing the advertiser proposition separately. No scheduled prompt changes are part of this patch.

## Evidence and limits

Read-only live Home/Topics inspection confirmed existing broad coverage and the narrow AI positioning. The refreshed source contains a September 30 board-reporting article that the initial live crawl omitted, so this patch preserves source cards rather than replacing them from the crawl. The weekly episode was verified in the source, not recreated. No live reporting-provider request was made. Mock fixtures establish behavior, not current Search Console access or current search demand. Case-insensitive clone warning exists for legacy ArticleImage17.jpg/Articleimage17.jpg; neither asset is changed.

### Completed validation

- `node --test tests/*.test.cjs`: 24/24 pass, including existing authentication, production drift, GA4 and banner tests plus five mocked Search Console tests and a receipt query-omission regression.
- `node scripts/generate-topic-hubs.mjs --check`: 13 hubs / 73 article placements pass.
- Alert-policy consistency, LinkedIn selection and Buffer reconciliation regressions pass.
- Local link audit: 18 entry/hub pages, no missing local targets; sitemap XML parses; all hubs meet the four-article minimum.
- Desktop 1440×1000 and mobile 390×844: 16 page checks, no horizontal overflow, mobile menu opens/closes, topic-to-article and briefing-to-original-sources paths pass. Screenshots saved next to this note. External browser requests were blocked, including analytics and embeds; video playback and live email/provider functionality were not tested.
- Agent-browser CLI was unavailable; QA used the installed Playwright library with a new headless Chrome process and temporary profile. No existing browser session was reused.
- `git diff --check`: pass.

### Follow-up privacy/inventory review

- Unchanged auth library and workflow: exact trusted GitHub-hosted main workflow identity; short-lived RS256 OIDC; unchanged readonly Search Console scope and service-account configuration; exact deployment SHA required. Authorized responses retain `Cache-Control: no-store, max-age=0` and `X-Robots-Tag: noindex, nofollow, noarchive`; auth rejections retain `no-store`. No public client calls or query data flow into HTML/JavaScript.
- Found and fixed a downstream persistence gap: runner previously saved entire reporting responses for the existing 14-day Actions artifact upload. It now omits query strings from both windows' saved rows while retaining metrics, pages and evidence. No query strings are printed to logs. Regression fixtures use a synthetic sentinel and assert it occurs in no saved file.
- Endpoint query text remains restricted internal data. Email/phone/length filtering is a precaution, not proof of complete de-identification. Response privacy wording explicitly acknowledges residual sensitive-text risk. Provider-anonymized queries are omitted, rows are bounded top results, detail totals cannot reconstruct aggregates, and finalized data is delayed.
- All 12 existing article URLs used by the three new hubs and the September 28 briefing returned live HTTP 200. New hub titles match live article H1s exactly. New hub URLs are local proposals, not falsely claimed live pages. No reach, audience size, ad performance or newsletter delivery claims added.
- Exact Home headline: **Industry News and Analysis for the Credit Union Ecosystem**. Exact paths: **Payments & Digital Money**, **Core Technology & Digital Banking**, **Vendors & Partners**. Four existing articles per new path.

Privacy filtering reference: https://developers.google.com/search/blog/2022/10/performance-data-deep-dive — anonymized query strings are omitted from API tables while aggregate totals can include them.
