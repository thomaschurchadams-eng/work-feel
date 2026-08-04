# CUAI Operating System — Authoritative Cloud Task Policy

## Status and authority

This is the authoritative operating policy for the **CUAI Operating System** ChatGPT Cloud task. Read this file from `main` before every run. If another prompt, prior chat, or stale instruction conflicts with this file, this file controls.

This policy coordinates the newsroom portfolio and operating handoffs. It does not create scheduled tasks or change Cloud schedules/models/permissions. It may run the bounded Alert cycle defined below after the day's article handoff has completed or been recorded; it must not publish full articles, perform unrelated maintenance, or perform social activity unless a separately authorized, current task policy explicitly allows it.

## Operating principle

CreditUnionAI News is a source-led publication for credit-union leaders and functional teams. Optimize for useful coverage across the full operating audience—not a narrow stream of generic AI news.

Maintain deliberate coverage across: boards and executive strategy; governance, risk, compliance, and legal; fraud and security; lending; payments and cards; member service and contact centers; marketing and growth; operations; digital/data/technology; HR and workforce; finance; and vendor/third-party management.

## Daily portfolio control

Each operating review should:

1. Read the current coverage ledger, editorial taxonomy, source registry, evergreen backlog, daily-cycle state, article classification records, analytics/SEO records, and relevant publishing policies.
2. Identify concentration, repetition, unserved functional audiences, stale evergreen opportunities, and source gaps.
3. Maintain a balanced content portfolio of:
   - timely source-led News;
   - practical Insights;
   - durable Library content in the evergreen backlog;
   - qualified Alerts evaluated separately from full articles.
4. Recommend or hand off the next strongest candidate to the daily-article policy. If daily news is weak, prioritize an approved evergreen-backlog topic rather than forcing low-quality news.
5. Treat **High**, **Standard**, and **Library** as operational classifications:
   - High: material and time-sensitive; may qualify for selective LinkedIn consideration.
   - Standard: useful site content; no routine LinkedIn promotion.
   - Library: durable, evergreen portfolio asset; no routine LinkedIn promotion.
6. Keep a clear distinction between a recommendation, a publication decision, and a completed production action.

## Daily Alert cycle and homepage freshness

After the day's article handoff has completed or been recorded, run one bounded Alert cycle. Read the existing Alert standards, Alerts data/page, ticker implementation, source registry, coverage ledger, publishing rules and daily-cycle state before writing.

- Search primary and credible sources across relevant beats for genuinely new, time-sensitive, operationally material developments since the last completed Alert cycle.
- Publish up to three qualified Alerts when the morning target has not been met; otherwise publish at most one genuinely new breaking Alert. Never lower sourcing, originality, correction, or editorial-trust gates to fill a target.
- Each Alert requires a factual headline, direct source URL, source name, date, neutral summary and a specific credit-union operating implication. Do not republish a full article as an Alert unless the Alert supplies a distinct urgent action the article does not already cover.
- Update the Alerts archive/data, ticker, homepage module, relevant ledgers and daily-cycle state in one atomic package. Re-read `main` immediately before writing, preserve concurrent changes, run the relevant validators, confirm a READY production deployment, and verify the live Alerts page, ticker and homepage.
- If no Alert qualifies, record the evidence gap in the task outcome. Do not manufacture an Alert.

The Alerts archive remains an archive. The homepage must never feature an Alert older than 72 hours. When no qualified fresh Alert exists, show the approved non-alert fallback rather than elevating stale material.


### What-to-watch freshness loop

When no fresh Alert is active, maintain the homepage's non-alert fallback in `assets/app.js` as follows:

- Before writing, inspect the current homepage cards and existing `homepageWatchState`. Select up to three already-published News or Insights items that are source-qualified, operationally useful, from distinct beats, and not already featured in the homepage card grid or represented by a current Alert.
- Update `homepageWatchState.reviewedAt` with the current ISO date and `homepageWatchState.items` with only the selected internal `href` and concise reader-facing `label`. Treat every selection as editorial curation, not a new publication.
- Each selection expires automatically after seven days. On every weekday review, replace it with newer qualifying coverage; never retain, recycle, or refresh its date merely to avoid the evergreen fallback.
- If no timely non-duplicative items qualify, clear `homepageWatchState.items`. The site will show its maintained evergreen vendor due-diligence tool instead. Do not fabricate urgency or use an Alert/archive item simply to fill the module.
- Validate that the homepage shows either a fresh Alert, fresh non-duplicative watch items, or the evergreen fallback; that all links resolve; and that no selected item duplicates a homepage card, active Alert, or materially identical article.

## Selective LinkedIn policy

LinkedIn is a selective channel:

- Consider promotion for High articles with a clear practical implication and a live, validated URL.
- Do not mirror every article, Alert, or evergreen item to LinkedIn.
- Preserve existing social safeguards, voice, approvals, schedules, credentials, and permissions.
- Log the reason for promotion or non-promotion so analytics can improve future choices.

## Analytics learning loop

Use the available analytics records to learn across content, not just individual posts:

- Track qualified engagement by functional audience, topic, format, source type, classification, homepage treatment, and LinkedIn decision.
- Look for repeatable signals and coverage gaps.
- Feed findings into the evergreen backlog and future candidate selection.
- Never let shallow engagement outrank accuracy, source quality, audience usefulness, or editorial safeguards.

## Strict publish-to-operate handoff

The operating system coordinates; focused publisher tasks publish.

After a publisher completes a verified run, accept only its handoff record: publication status, classification, functional audience, topic, source type, live URL, validation/deployment result, homepage treatment, LinkedIn decision, Alert consideration, and blocker if any.

Do not reopen or duplicate the publisher's work in the same run. The bounded Alert cycle above is the only permitted publishing follow-on in this task; do not combine it with full-article publishing, maintenance, or social activity.

## Reporting and failure behavior

Record decisions and non-publication outcomes in the appropriate existing operational ledger/state. Keep the result concise and auditable.

If the required evidence, source access, production validation, or a clearly authorized workflow is missing, stop and report the exact blocker. Do not invent content, bypass safeguards, alter Cloud task configuration, or make unrelated site changes.
