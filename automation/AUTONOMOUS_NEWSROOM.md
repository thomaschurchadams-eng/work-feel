# Autonomous Newsroom Runbook

## Objective

Publish six to eight credible, varied CreditUnionAI News stories each week and create five differentiated LinkedIn packages. Routine validated articles publish directly to production without human approval.

## Standard run

1. Read the taxonomy, source registry, publishing rules, coverage ledger, voice guide, image guidelines, newsroom state, current homepage, news index, sitemap, and recent article files.
2. Search the prior 24–48 hours across every beat. Prefer primary documents and developments with a clear credit-union operating implication.
3. Build a candidate set before drafting. Normalize every candidate to the taxonomy and score it with the coverage engine.
4. Select only candidates that meet the score and hard-stop rules. Never write a weak story merely to meet volume.
5. Choose the correct format and length. Reporting must lead with the verified event; analysis must add original synthesis rather than paraphrase sources.
6. Create a clean kebab-case article URL under `/news/`. Include title, description, canonical URL, Open Graph metadata, date, byline, tags, source links, related coverage, and accessible image treatment.
7. Update `news.html`, the homepage when appropriate, `sitemap.xml`, `sitemap.txt`, `coverage-ledger.json`, `newsroom-state.json`, and `social-queue.json` in the same commit.
8. Validate links, paths, HTML structure, dates, metadata, duplication, attribution, source support, and conflict rules.
9. Commit the complete validated package directly to `main` with `Publish: <headline>`.
10. Confirm the Vercel production deployment is READY and verify the article URL. If deployment or verification fails, fix or revert only the new package; do not leave a broken production state.

## Breaking-news run

Publish outside the standard schedule only when a development is time-sensitive, well sourced, materially relevant to credit unions, and scores at least 78. Breaking items may be 250–450 words but must still pass every hard stop. Avoid publishing multiple incremental rewrites of the same event.

## Weekly portfolio

- Monday: outlook or trend brief
- Tuesday: reported news plus practical article
- Wednesday: reported news or flagship analysis
- Thursday: reported news plus case study, interview, comparison, or explainer
- Friday: weekly briefing or data-led roundup

Target at least five distinct credit-union functions and three formats per week. No primary function or technology should lead more than two scheduled stories unless the news cycle clearly demands it.

## Social package

Create one LinkedIn package for each weekday, but do not make every post an article advertisement. Rotate among launch post, useful native insight, carousel outline, role-specific takeaway, pointed industry question, and weekly roundup. Each package should have a strong first line, substantive native value, one specific discussion prompt, article URL, and scheduled time in Eastern Time.

## Failure behavior

Do not publish when evidence, confidence, attribution, or technical validation fails. Record the candidate and exact reason in `newsroom-state.json`. Routine failures should not request human approval. Notify Tom only for repeated pipeline failures, production breakage, potential legal/reputational risk, or an editorial-policy decision the rules do not resolve.
