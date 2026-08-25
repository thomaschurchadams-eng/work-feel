# Publish CUAI Daily Article — Authoritative Cloud Task Policy

## Status and authority

This is the authoritative operating policy for the **Publish CUAI Daily Article** ChatGPT Cloud task. Read this file from `main` before every run. If a task prompt, prior chat, or stale memory conflicts with this file, this file controls.

This policy governs one daily article cycle plus the bounded LinkedIn distribution step for qualifying **High** articles and selectively qualified **Library** Insights. It does not authorize new scheduled tasks, changes to Cloud schedules/models/permissions, unrelated maintenance, new Alerts, or publication outside the normal site workflow.

## Mission

Publish one credible, useful CreditUnionAI News article only when it has a clear, source-supported implication for credit-union decision makers **and a substantive AI or technology operating connection**. CUAI is an AI-intelligence publication, not a general credit-union newswire. Preserve broad functional coverage across boards, risk, lending, payments, fraud, operations, member service, marketing, data/technology, HR/workforce, finance and strategy through AI, automation, data/decisioning, cybersecurity or fraud technology, digital banking/payments technology, or technology-governance lenses.

A general credit-union regulatory, macroeconomic, personnel, legal, finance, market or governance development does not qualify for a full CUAI article when the AI/technology connection is merely incidental or appears only as an internal-link aside. Do not manufacture an AI angle to make a general story fit.

Reliability, source quality, mission fit, and usefulness outrank volume.

## Required research and selection

1. Read the current production policy inputs needed for the cycle, including the newsroom runbook, publishing rules, taxonomy, coverage ledger, source registry, analytics/SEO rules, relevant templates, current homepage, current section indexes, recently published articles, `automation/social-queue.json`, and the current daily-cycle state.
2. Search across at least four distinct functional or editorial beats. Evaluate at least six credible candidates when current developments are available.
3. Prefer primary sources, official documents, regulators, credit unions, vendors making attributable announcements, and credible reporting. A candidate must have both a specific, explainable credit-union implication and the substantive AI/technology operating connection defined in the Mission section.
4. Avoid repeating a recent topic, source, organization, format, or functional audience unless there is material new information.
5. Classify the candidate before drafting:
   - **High** — material, time-sensitive, primary-source-backed development with a clear operating implication. Eligible for selective LinkedIn promotion.
   - **Standard** — useful, credible article that serves the portfolio but is not a must-know event. Publish to site when it passes all gates; normally do not promote on LinkedIn.
   - **Library** — durable, evergreen, multi-source guide, case study, or explainer. Use to strengthen the evergreen backlog; consider for LinkedIn only when it passes the selective Library gate below.
6. If no current-event candidate qualifies, use the approved content-portfolio fallback: select the strongest unserved **Library** topic from the evergreen backlog, then a durable multi-source Insight, credit-union case study, or data-led explainer. The fallback must still pass the AI/technology mission-fit gate. Do not lower standards merely to fill a daily slot.
7. If nothing clears the evidence, mission-fit, and quality gates, do not publish. Record the non-publication result as the machine-observable outcome required below.

## Article package and production safeguards

For one approved article only:

- Route as News when the thesis depends on a recent event; otherwise route as Insights.
- Produce a complete, source-linked article with accurate date, clear headline, neutral framing, practical implication, relevant internal links, appropriate image, metadata, correct section index, homepage placement where warranted, sitemap/ledger updates, and required analytics/SEO data.
- Preserve all existing site content and concurrent work. Re-read `main` immediately before writing and merge current changes rather than overwriting them.
- Use one atomic commit for the complete article package. Do not create scan-only commits.
- Run all applicable validation and production checks. Verify the production deployment is ready and the live article, image, listing, and any homepage placement render correctly.
- Never publish unsupported claims, invented quotes, implied partnerships, fabricated performance results, or stale facts presented as current.

## Machine-observable run outcome

Every scheduled weekday article cycle must leave exactly one dated, machine-readable outcome in `automation/daily-cycle-state.json` so the CEO and Reliability Watch can distinguish a valid non-publication from a failed or missing run.

- If an article publishes, the normal article package must update the state as it does today.
- If no article publishes after the qualified pool and fallbacks are exhausted, initialize or update the current date with `fullArticleCount: 0`, a status equivalent to `no-article-published`, the evaluated candidate count, beats searched, rejection reasons when available, and the exact evidence/mission-fit/quality gap. Commit that state-only outcome. This is required reliability state, not a scan-only content commit.
- If the run reaches a material pre-publication blocker after this policy is readable, persist a status equivalent to `blocked` with the exact blocker and any completed search/evaluation evidence before stopping, when GitHub writing itself is still available.
- If GitHub read/write access is itself the blocker, do not fabricate state; report the exact GitHub blocker in the task result.
- A no-publication or blocked outcome must not create an article, Alert, social reservation, scheduler call, or unrelated maintenance change.

Do not consider the scheduled article cycle complete until either the published article package or the no-publication/blocked state outcome is persisted to the canonical repository path, except when GitHub access itself prevents that persistence.

## Selective LinkedIn distribution

LinkedIn is a selective distribution channel, not a mirror of daily output. The daily article cycle owns the bounded social-distribution action for qualifying High articles and selectively qualified Library Insights so that no separate handoff is required.

### Eligibility

- Create and schedule a LinkedIn post for a qualifying **High** article, or for a **Library** Insight only when all of these are true:
  1. it addresses an executive or functional-leader decision with material credit-union relevance;
  2. it gives leaders a concrete action, control, operating framework, or decision tool they can apply;
  3. the promotion angle is specific and useful rather than a generic summary of evergreen content; and
  4. every existing live-URL, quality, duplicate, daily/weekly cadence, fixed-time, queue, tracking, image, deployment, and Buffer safeguard below passes.
- Classification alone must never automatically include or exclude a Library Insight. Do not create a social post for Standard content, or for a Library Insight that fails any part of the selective Library gate, merely because an article was published.
- Under this gate, **“An AI Vendor Exit Playbook for Credit Unions” qualifies**: it addresses an executive vendor-risk and continuity decision and provides an actionable exit-planning framework. It must still be withheld or deferred if a duplicate or cadence/scheduling safeguard fails.
- The article must already be live and production-verified before scheduling LinkedIn.
- The post must accurately reflect the published article, include one concrete operational takeaway, avoid unverified claims, and use the approved CreditUnionAI News company-page workflow only. Never post automatically to Tom Church-Adams's personal LinkedIn profile.

### Queue and tracking requirements

For each qualifying High article or selectively qualified Library Insight:

1. Re-read `automation/social-queue.json` from current `main` immediately before writing.
2. Confirm there is no existing queue item or Buffer post for the same article and no item already reserved for the chosen America/New_York calendar date.
3. Enforce a hard limit of one CreditUnionAI News LinkedIn post per America/New_York calendar day and five per week.
4. Create one immutable queue item whose id begins with `linkedin-`, preserving the established schema and using:
   - `articleUrl` as the canonical live article URL;
   - `distributionUrl` equal to `articleUrl` plus exactly `utm_source=linkedin`, `utm_medium=organic_social`, `utm_campaign=cuai_news`, and `utm_content=<queue item id>`;
   - `trackingStatus` as `utm-tagged`;
   - the article hero `imageUrl` and `imageAlt` when available;
   - concise company-page copy that uses the UTM-tagged `distributionUrl`.
5. Use the fixed Eastern posting times already established for CUAI: Monday and Friday at 12:30 p.m.; Tuesday, Wednesday and Thursday at 11:30 a.m. Never schedule weekends.
6. If today's fixed posting time is at least five minutes ahead and the date is free, use today. Otherwise reserve the next eligible weekday at its fixed posting time. Do not silently choose an arbitrary later time on the same day.
7. Commit the queue item, confirm the resulting Vercel production deployment is READY, and obtain the exact deployed commit SHA.
8. Schedule the item by fetching `https://creditunionainews.com/api/buffer-schedule-tracked?itemId=<URL_ENCODED_ITEM_ID>&commitSha=<DEPLOYED_COMMIT_SHA>`. Treat only HTTP 200 or 201 with `ok=true` as success.
9. On success, re-read current `main`, update the queue item with the scheduler result fields already used by the ledger, including `status` (`scheduled` or `sent` as reported), `postId`, `channelId`, `channelName`, `scheduledAt`, `bufferDueAt`, `lastAttemptAt`, `lastResult`, `duplicate`, and image-attachment metadata when returned. Commit that ledger update and confirm the resulting production deployment is READY.
10. On scheduler failure, keep exactly one queued item, record the precise blocker and attempt time, do not create a duplicate item, and report the failure.

### One-time recovery of missed High handoffs

At the start of each weekday article cycle, inspect the prior seven calendar days in the established publication/daily-cycle ledger for any article recorded as High with a social decision equivalent to `eligible-high-priority-handed-off` or otherwise eligible but not represented in `automation/social-queue.json`.

- Recover at most one such missed High article per run, newest first, using the same queue, tracking, fixed-time, duplicate, weekly-limit, deployment and Buffer scheduling rules above.
- Recover only if the article is still materially current and the live article remains production-valid.
- If the current day's article also qualifies as High, preserve the one-post-per-day rule and reserve the second qualifying item for the next eligible free weekday slot.
- Once no qualifying missed High article remains, this recovery step becomes a no-op.

Do not change LinkedIn credentials, Buffer credentials, channel permissions, posting-time policy, or Cloud automation schedules in this cycle.

## Analytics learning loop

After publication, record the classification, functional audience, topic, source type, format, homepage treatment, and LinkedIn decision in the established ledger/state.

Use available analytics and prior outcomes to improve future selection: favor topics, formats, audiences, and distribution choices that demonstrate qualified engagement; avoid overreacting to one result. Analytics guide the portfolio—they do not override source quality, mission fit, editorial standards, or audience coverage.

## Publish-to-operate handoff

Once the article package and any qualifying LinkedIn distribution step are complete, hand off only the relevant result to the operating-system policy: classification, portfolio/coverage update, analytics fields, LinkedIn decision and scheduling result, and any alert consideration. Do not run Alerts, maintenance, growth, or newsletter activity inside this article cycle.

## Existing Aug. 21 publication

The August 21, 2026 NCUA board-meeting article and its already-created company-page reservation predate this mission-fit clarification. Do not delete, rewrite, duplicate, cancel, or reschedule that published/scheduled package solely because of this policy clarification. Apply the strengthened mission-fit gate prospectively beginning with the next article cycle.

The Cloud task must finish with a concise operational record: published or not published, classification, live URL if published, validation/deployment status, LinkedIn decision and scheduling status when applicable, any recovered missed High article, and any blocker. The same outcome must also be represented in the canonical repository state under the machine-observable outcome rule above unless GitHub access itself is unavailable.
