# Publish CUAI Daily Article — Authoritative Cloud Task Policy

## Status and authority

This is the authoritative operating policy for the **Publish CUAI Daily Article** ChatGPT Cloud task. Read this file from `main` before every run. If a task prompt, prior chat, or stale memory conflicts with this file, this file controls.

This policy governs one daily article cycle plus the bounded LinkedIn distribution step for qualifying **High** and useful **Standard** articles, selectively qualified **Library** Insights, and already-qualified media within the existing shared slots. It does not authorize new scheduled tasks, changes to Cloud schedules/models/permissions, unrelated maintenance, new Alerts, or publication outside the normal site workflow.

## Mission

Cover consequential credit-union industry developments with a concrete, source-supported implication for CU decision makers. AI and technology remain signature strengths, not mandatory angles. Material regulation, finance, lending, payments, member service, workforce, competition and governance qualify without an invented AI connection. Reject routine personnel notices, promotion-only releases and generic developments without meaningful CU consequence.

Reliability, source quality, mission fit, and usefulness outrank volume.

## Required research and selection

### Early browser readiness and exact-revision fallback

Before beginning research or image generation, run `npm run check:browser` in the current ordinary publisher checkout. This actually launches the pinned browser and renders mobile/desktop smoke pages; it is not site acceptance. Preserve its revision/cache receipt. A missing executable, launch failure or observed cache mutation blocks the cycle early. Do not repeat unchanged failed installation commands, clean a shared browser cache, change pinned versions or request broader access as an automatic workaround. The existing `reliability-watch` role owns incident triage; `daily-publisher` owns this browser gate and the next exact article acceptance. Reuse the original issue #160 incident/dedupe key rather than creating another publisher or replaying a completed cycle.

If local launch is unavailable, the existing pull-request `design-checks` job in `CUAI verified operations` is the permitted alternate acceptance path. A current passing prevention/baseline run proves fallback capability only, not acceptance of a later article. The next ordinary cycle may prepare its qualified package for this path, but must hold release until exact-head acceptance and visual review pass. Submit only the exact ordinary article/prevention revision under review, never an uncleared private expansion or a dummy content change. It checks out the exact PR head with read-only permissions, uses its job-local browser cache and runs the complete normal rendered suite. Verify that run/artifact/revision match the exact candidate; changed News/Insights paths must appear in the rendered route results at 390 and 1440 pixels, with accessibility, artwork normal/404/recovery and existing journey checks retained. Inspect the resulting screenshots and actual paths before a later ordinary release. A past green run, a discovered runner, launch smoke alone or HTTP 200 is not clearance. If no exact passing artifact and capable visual review are available, remain blocked. Local/shared-runtime isolation remains unproven unless separately evidenced; do not promise recurrence is impossible. No schedule, model, permission, persistent access, source/editorial gate or social rule changes are authorized by this path.

1. Read the current production policy inputs needed for the cycle, including the newsroom runbook, publishing rules, taxonomy, coverage ledger, source registry, analytics/SEO rules, relevant templates, current homepage, current section indexes, recently published articles, `automation/social-queue.json`, and the current daily-cycle state.
2. Search across at least six distinct functional or editorial beats. Evaluate at least twelve credible candidates when current developments are available.
3. Prefer primary sources, official documents, regulators, credit unions, vendors making attributable announcements, and credible reporting. A candidate must have a specific, explainable credit-union implication under the Mission section.
4. Avoid repeating a recent topic, source, organization, format, or functional audience unless there is material new information.
5. Classify the candidate before drafting:
   - **High** — material, time-sensitive, primary-source-backed development with a clear operating implication. Eligible for selective LinkedIn promotion.
   - **Standard** — useful, credible article that serves the portfolio but is not a must-know event. Publish to site when it passes all gates; consider for LinkedIn when it passes the practical-usefulness gate below. A major-event label is not required.
   - **Library** — durable, evergreen, multi-source guide, case study, or explainer. Use to strengthen the evergreen backlog; consider for LinkedIn only when it passes the selective Library gate below.
6. If no current-event candidate qualifies, use the approved content-portfolio fallback: select the strongest unserved **Library** topic from the evergreen backlog, then a durable multi-source Insight, credit-union case study, or data-led explainer. The fallback must still pass the credit-union relevance gate. Do not lower standards merely to fill a daily slot.
7. If nothing clears the evidence, mission-fit, and quality gates, do not publish. Record the non-publication result as the machine-observable outcome required below.

## Article package and production safeguards

For each qualifying article, sequentially:

- Route as News when the thesis depends on a recent event; otherwise route as Insights.
- Produce a complete, source-linked article with accurate date, clear headline, neutral framing, practical implication, relevant internal links, appropriate image, metadata, correct section index, homepage placement where warranted, sitemap/ledger updates, and required analytics/SEO data.
- Preserve all existing site content and concurrent work. Re-read `main` immediately before writing and merge current changes rather than overwriting them.
- Use one atomic commit for the complete article package. Do not create scan-only commits.
- Run all applicable validation and production checks. Verify the production deployment is ready and the live article, image, listing, and any homepage placement render correctly.
- Artwork must be explicitly selected and relevant; never fill missing listing artwork with rotating generic or placeholder assets. Legacy cards without approved art may be intentionally text-only. Inspect listing cards on desktop/mobile, preserve working authored art, and exercise image-error behavior: retain readable title/summary/link without a broken-image box or unrelated replacement. Unexpected failed assets still fail readiness even if the interface degrades gracefully. Run the normal rendered acceptance path, including its card-artwork regressions, before handoff.
- Never publish unsupported claims, invented quotes, implied partnerships, fabricated performance results, or stale facts presented as current.

### Pending validation ownership and terminal evidence

While an exact-head PR check is running, retain `daily-publisher` ownership of the same PR, head, run, job and attempt. Persist its checkpoint in the existing slot evidence and issue #160, with an offset-qualified `nextReviewAt`; a review timestamp is not a scheduled execution. Do not replace an already persisted article outcome with a competing state-only closeout merely because the next slot is still validating.

Before terminal closeout, use `inspectUsingGitHubTools` from `lib/publisher-validation.cjs` through the existing authorized GitHub readers. Supply the exact PR number, head SHA, run/job IDs, verified attempt, owner and review time. A pending, unknown, inaccessible or stale-head result cannot clear a release or remove ownership. The run and exact job must agree on head and attempt. An older checkpoint with unknown attempt must first record `attemptResolution` from matching authoritative run/job observations and persist that attempt before closeout. On a changed candidate or attempt, retain the previous checkpoint and any terminal receipt in `evidence.validationHistory` as superseded and validate the new head. A terminal success requires exact-artifact inspection and actual visual review; the helper never grants publication permission or claims live verification. It creates no follow-up execution or external write.

#### Executable binding in the tools runtime

At this entry point, run the following in the ordinary `functions.exec` runtime, then call `await inspectOwnedValidation({ kind: 'validation', pending })` with the exact owned checkpoint described above. Use `kind: 'ordinary'` for work without a pending checkpoint and `kind: 'held'` for valid editorial/approval holds; both return before any GitHub read. Repeated validation reads perform no writes; a closed PR returns reconciliation and must not be reopened. Use the actual current clock and observations; never manufacture a pending result from a terminal run.

```javascript
async function inspectOwnedValidation({ kind, pending }) {
  if (!['validation', 'ordinary', 'held'].includes(kind)) throw Error('unknown-validation-mode');
  if (kind !== 'validation') return {
    decision: 'not-applicable', reason: kind, releaseReady: false, shouldEscalate: false
  };
  const repository = 'thomaschurchadams-eng/work-feel';
  const expectedBlob = '3cf8d0c54f0031e2ac1bd388eda601dca6e1eed7';
  const mainRead = await tools.mcp__codex_apps__github_fetch({
    url: `https://api.github.com/repos/${repository}/commits/main`
  });
  if (mainRead?.isError || mainRead?.structuredContent?.error) throw Error('main-read-blocked');
  const sourceCommit = JSON.parse(mainRead.structuredContent.content).sha;
  if (!/^[a-f0-9]{40}$/.test(sourceCommit)) throw Error('main-identity-unavailable');
  const fetched = await tools.mcp__codex_apps__github_fetch_file({
    repository_full_name: repository, path: 'lib/publisher-validation.cjs', ref: sourceCommit
  });
  const source = fetched?.structuredContent;
  if (fetched?.isError || source?.error || source?.sha !== expectedBlob ||
      source?.encoding !== 'utf-8' || typeof source?.content !== 'string')
    throw Error('reviewed-helper-source-unavailable-or-mismatched');
  const helperModule = { exports: {} };
  new Function('module', 'exports', 'require', 'tools', 'fetch', source.content)(
    helperModule, helperModule.exports, undefined, undefined, undefined
  );
  const readers = Object.freeze({
    mcp__codex_apps__github_get_pr_info: args => tools.mcp__codex_apps__github_get_pr_info(args),
    mcp__codex_apps__github_fetch: args => tools.mcp__codex_apps__github_fetch(args)
  });
  return helperModule.exports.inspectUsingGitHubTools({ tools: readers, repository, pending });
}
```

A source/read/loader error preserves the existing owner and checkpoint and blocks closeout; do not retry a denied read or substitute another source. The blob pin is the reviewed helper version; update it only alongside a separately reviewed helper change. This binding resolves authorized main, so it becomes available only after release. The November 7 draft acceptance separately loaded the same blob from frozen candidate `383f305824e8141d83427fed73be7d3ae3395012`; that test does not activate the draft. Artifact identity, actual visual review and every release gate remain separate.

Store the observed terminal receipt as `evidence.terminalValidation` with matching head/run/job, attempt, conclusion and observation time. Any new entry into live from any status also requires matching `terminalAcceptance` including the job and actual `visualReviewedAt`, plus the normal live URL, production commit and verification time. Retain owner/review on a technical failure. Run the existing preservation validator against freshly read current main before writing; its PR/main workflow gates reject lost same-day publications, reduced counts, dropped unresolved or completed slots and unsupported terminal closeouts. Completed receipts are append-only and cannot be reopened; a new problem uses its own linked incident. The main gate checks every state-changing first-parent revision since the reviewed `aa43cf2782628289bd927c480799ba15b45af4be` baseline plus the actual pre-push SHA, so an unrelated follow-up, scheduled or manual run cannot clear an earlier rejected transition. Missing baselines fail closed. An invalid historical transition remains blocked even after full state restoration; activation therefore requires an agreed recovery procedure using a separately reviewed baseline migration, never an automatic reset. Expected-version reconciliation and every existing editorial/visual/deployment/social gate still apply. If the externally managed owner has not yet bound this read-only helper, report integration as unverified rather than claim autonomous recovery.

## Machine-observable run outcome

Every scheduled weekday article cycle must leave exactly one dated, machine-readable outcome in `automation/daily-cycle-state.json` so the CEO and Reliability Watch can distinguish a valid non-publication from a failed or missing run.

- If an article publishes, the normal article package must update the state as it does today.
- If no article publishes after the qualified pool and fallbacks are exhausted, initialize or update the current date with `fullArticleCount: 0`, a status equivalent to `no-article-published`, the evaluated candidate count, beats searched, rejection reasons when available, and the exact evidence/mission-fit/quality gap. Commit that state-only outcome. This is required reliability state, not a scan-only content commit.
- If the run reaches a material pre-publication blocker after this policy is readable, persist a status equivalent to `blocked` with the exact blocker and any completed search/evaluation evidence before stopping, when GitHub writing itself is still available.
- If GitHub read/write access is itself the blocker, do not fabricate state; report the exact GitHub blocker in the task result.
- A no-publication or blocked outcome must not create an article, Alert, social reservation, scheduler call, or unrelated maintenance change.

Do not consider the scheduled article cycle complete until either the published article package or the no-publication/blocked state outcome is persisted to the canonical repository path, except when GitHub access itself prevents that persistence.

### State-preservation invariant for daily article writes

`automation/daily-cycle-state.json` is append-style audit state. Advancing the current date must never discard the prior completed cycle.

- Re-read the exact current `main` state immediately before the article package write. When `current.date` changes, move the complete prior `current` object into `history` before replacing `current`; do not reconstruct the file from a truncated snippet or a stale historical slice.
- When a whole-file replacement is the only available writer, resolve the exact current `main` blob SHA and retrieve the complete blob before preparing the replacement. If complete retrieval is unavailable, block the state write rather than risking audit-history loss.
- Before merge or direct publication, compare the proposed state with the immediately preceding `main`. Every pre-existing dated history entry must remain present, the prior `current` date must be present in the new history when the date advances, history must not shrink, and the new `current.date` must not regress. Any unexplained deletion is a hard stop even when the article itself validates.
- In a checkout-capable workspace, run `node scripts/validate-daily-cycle-preservation.mjs automation/daily-cycle-state.json main` whenever the publisher changes daily-cycle state. In a connector-only runtime, perform the equivalent branch-vs-`main` date/history-preservation comparison before writing or merging.
- After the state write lands, re-fetch `automation/daily-cycle-state.json` from the exact resulting commit/blob and parse that stored blob as UTF-8 JSON, then repeat the preservation check against the immediately preceding `main`. A local/pre-write validation is not sufficient. If the committed blob is unreadable, invalid JSON, unexpectedly collapsed, or loses prior state, treat the write as failed and stop the downstream handoff rather than reporting the cycle as successfully persisted.

## Selective LinkedIn distribution

LinkedIn is a selective distribution channel, not a mirror of daily output. The daily article cycle owns the bounded social-distribution action for qualifying High and Standard articles and selectively qualified Library Insights so that no separate handoff is required. Tom approved useful Standard-story eligibility on November 11, 2026; he did not approve a higher posting cap or restarting paused multimedia production.

### Eligibility

- Consider a qualifying **High** article, useful **Standard** story, or **Library** Insight only when all of these are true:
  1. it addresses an executive or functional-leader decision with material credit-union relevance;
  2. it gives leaders a concrete action, control, operating framework, or decision tool they can apply;
  3. the promotion angle is specific and useful rather than a generic summary of evergreen content; and
  4. every existing live-URL, quality, duplicate, daily/weekly cadence, fixed-time, queue, tracking, image, deployment, and Buffer safeguard below passes.
- Classification alone must not automatically include or exclude a High, Standard or Library story. Standard is now eligible for the same practical-usefulness review; publication alone is not promotion qualification. Keep Library’s executive-relevance and concrete-action gate intact. Recheck source currency and the live body, record the actual reader decision and takeaway, and mark only passing candidates `eligible: true`. Do not relabel a story High, inflate its editorial score, invent urgency or automatically backfill previously excluded Standard stories.
- Under this gate, **“An AI Vendor Exit Playbook for Credit Unions” qualifies**: it addresses an executive vendor-risk and continuity decision and provides an actionable exit-planning framework. It must still be withheld or deferred if a duplicate or cadence/scheduling safeguard fails.
- The article must already be live and production-verified before scheduling LinkedIn.
- The post must accurately reflect the published article, include one concrete operational takeaway, avoid unverified claims, and use the approved CreditUnionAI News company-page workflow only. Never post automatically to Tom Church-Adams's personal LinkedIn profile.

### Queue and tracking requirements

For the selected qualifying High, Standard or Library article:

1. Re-read `automation/social-queue.json` from current `main` immediately before writing.
2. Freshly inspect the complete current provider reservation inventory as well as main: confirm there is no existing queue item or Buffer post for the same article/underlying publication and no item already reserved for the chosen America/New_York calendar date. Missing provider access or incomplete inventory leaves the selection prepared, not reserved. Sent-post metrics alone cannot clear future capacity; never invoke a scheduling endpoint just to obtain a read.
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
8. The production deployment triggers `CUAI verified operations`, which uses short-lived GitHub workflow identity to call the scheduler. Read `automation/SECURE-OPERATIONS.md` and verify its outcome receipt. Do not call the scheduler with a public URL or commit SHA as authentication. Treat only a recorded HTTP 200/201, `ok=true` and Buffer post id as scheduling success.
9. The verified workflow records the queue receipt automatically. On success, re-read current `main` and verify that the queue item contains the returned scheduling receipt, including `status` (`scheduled` or `sent` as reported), `postId`, `channelId`, `channelName`, `scheduledAt`, `bufferDueAt`, `lastAttemptAt`, `lastResult`, `duplicate`, and image-attachment metadata when returned. Confirm the resulting production deployment is READY. Do not write the same receipt a second time. If the receipt is missing, report the reconciliation blocker and check the preserved workflow artifact before attempting a repair; do not reschedule the post.
10. On scheduler failure, keep exactly one queued item, record the precise blocker and attempt time, do not create a duplicate item, and report the failure.

### Choose the strongest useful mix

The sole publisher compares all currently qualified candidates for an unreserved slot. Prioritize the concrete credit-union decision, evidence quality, source currency and any genuine time sensitivity. Among similarly useful candidates, prefer a different functional audience, topic or format from the recent sent/reserved mix. Examine the existing queue and complete current provider inventory; unknown observations remain unknown. Mix is a tie-break, not a quota, new score or justification to promote weak material. An urgent High item can lead on its evidence; a useful Standard, Library Insight or verified media piece can also lead. A genuinely empty qualified pool stays empty.

Use the existing selector with `{ "articles": [...], "editorialOrder": [{ "canonicalUrl": "...", "rationale": "..." }, ...] }`. `editorialOrder` lists every currently qualified, unduplicated article/media destination exactly once, strongest first. Each reason records why the item belongs in this slot relative to the other choices and recent mix. Preserve this dated comparison in the existing run/selection receipt, not a new tracker. A legacy article array still works for one qualified candidate. With multiple choices and no complete reasoned order, the selector returns `needs-editorial-selection`; it must not silently choose by input order or fall through to a house campaign. Inspect its returned pool, complete the comparison and run it again. The result is read-only preparation, not a reservation, proof of provider capacity or permission to publish unverified media.

This change leaves one weekday post/day, five/week, fixed Eastern times, all immutable reservations, deduplication, the selective Library gate, media rights/accessibility/live verification and sole-publisher ownership intact. It does not restart paused multimedia, timing or copy experiments. Existing experiment cohorts retain their original eligibility and must not silently absorb the broadened pool. Review cadence separately using comparable evidence before proposing a different cap.

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

## October 5 owner-approved editorial hook test

Prospectively, within the existing qualified pool and daily slots, test one framing change for AI stories: lead the headline/opening with a concrete credit-union workflow or source-supported outcome in member service, fraud, lending, collections/hardship or staff time. Prefer a distinctive, evidenced AI angle where broader CU news supports one; never invent that connection. Put governance/control detail in supporting reporting instead of repeating a generic checklist headline. Hypothetical scenarios must be labeled; never imply achieved savings, adoption or customer results without evidence. Collections/hardship is a candidate, not a prepared or selected story. Preserve the broader industry portfolio and every existing source, freshness, classification, coverage, publication, spend, identity, dedup and social safeguard.

This is one hook test, not an additional scan, quota, publisher or schedule: keep the eight-article evidence-gated weekly cadence, maximum two per weekday, bounded research, sequential publication and sole existing LinkedIn executor with shared caps. Do not rerun or rewrite already completed October 5 publications for this test. Record actual published cohort IDs/dates and hook type in the existing run outcome/coverage record; do not add a new tracking integration or storage schema.

Use September 21–October 4 as the fixed baseline article inventory, identifying unavailable or unsuitable comparators. At the existing October 12 weekly review, check implementation and honestly labeled early signals; defer performance judgment until comparable measurement ages are available. Compare Search Console CTR with clicks/impressions, dates and reporting-delay/privacy limits; engaged reading with the existing analytics definition and denominators; subscriptions only where an existing attributed signup event supplies evidence. Use the same source, definition and measurement age for baseline and test articles. Missing, inaccessible, untracked or not-yet-aged data remains unknown, never zero. Topic/distribution differences and small samples do not establish a causal improvement. Existing quality and breadth rules continue to govern selection; no fabricated results or new subscription pipeline.

## Publish-to-operate handoff

Once the article package and any qualifying LinkedIn distribution step are complete, hand off only the relevant result to the operating-system policy: classification, portfolio/coverage update, analytics fields, LinkedIn decision and scheduling result, and any alert consideration. Do not run Alerts, maintenance, growth, or newsletter activity inside this article cycle.

## Existing Aug. 21 publication

The August 21, 2026 NCUA board-meeting article and its already-created company-page reservation predate this mission-fit clarification. Do not delete, rewrite, duplicate, cancel, or reschedule that published/scheduled package solely because of this policy clarification. Apply the strengthened mission-fit gate prospectively beginning with the next article cycle.

The Cloud task must finish with a concise operational record: published or not published, classification, live URL if published, validation/deployment status, LinkedIn decision and scheduling status when applicable, any recovered missed High article, and any blocker. The same outcome must also be represented in the canonical repository state under the machine-observable outcome rule above unless GitHub access itself is unavailable.

## September 29 owner-approved breadth and volume alignment

Tom requested implementation of broader CUAI coverage and increased volume in the Chief of Staff conversation. Effective September 30, this section supersedes conflicting one-article-only or mandatory-technology-angle language in historical prompts and rules. Preserve existing schedules, credentials, validations and selective LinkedIn limits.

Use `publishing-rules.json` weekday targets: Monday/Wednesday/Friday two articles, Tuesday/Thursday one, eight per full week, maximum two per weekday. This is an evidence-gated target, not a quota. Complete and verify the first package before attempting the second. Re-read main and preserve all same-day publications and prior history in every write; increment actual counts, never replace the first outcome. If the second slot cannot qualify, retain the first publication and record the unfilled slot and reason. Existing dailyTargets metadata is legacy; version 6 publishing rules govern the new targets.

At most twelve well-supported candidates across six beats are sufficient for the normal bounded scan; no endless searching to fill slots. Include official OpenAI, Anthropic, Microsoft and Google/DeepMind announcements when relevant, alongside regulators, CU primary reporting and broader industry sources. Peter Diamandis MetaTrends is a discovery input when accessible, not independent substantiation. Do not bypass source-access restrictions. Distinguish announcement, preview and actual availability; attribute vendor benchmarks and verify consequential claims.

Prefer reported news, short source-backed explainers, data briefs and case studies alongside practical guidance. Aim for three formats and five functions weekly; cap repetitive framework/checklist pieces at two combined unless a material-news exception is recorded. Nontechnology stories use `industry-development` as their taxonomy marker rather than inventing a technology link.

Review two full weeks on October 16: delivery, corrections, breadth, actual usage and available engagement. Ten articles per week remains a later decision. No new recurring cost or paid service is authorized. If second slots create material evidence, deployment or usage problems, stop those slots and preserve the healthy primary cycle.

## Shared media selection — approved October 1, 2026

### Approved CUAI house campaign — November 3, 2026

Tom approved the reader-value and sponsorship messages and ongoing CUAI website/company-page campaign in `automation/house-campaign.json` (approval `Sentinel_49f140f977248191b053657128260f4b`). This is a narrow exception for those approved house messages to the article-only/generic-growth restriction, not a change to editorial classification or a revival of old copy experiments. The existing daily publisher remains the sole social owner; no new publisher or schedule is authorized.

After qualified High/Standard articles, selectively qualified Library material and already-prepared qualified media, the selector may return an approved house item as `prepared-selection`. This is a file handoff, not evidence of acceptance, queueing or delivery. Never displace an existing reservation, delay news/media to force a house post, or add a mandatory campaign quota. Preserve every current daily/weekly cap, fixed Eastern time, live destination/image, rights, accessibility, deduplication, immutable copy/UTM and provider receipt gate. X, personal profiles and paid ads remain excluded. This owner performs no outbound sponsor email.

Before any reservation, freshly read current main queue AND real existing provider state, check the campaign against the latest approval and reader feedback, and inspect the actual live destination/mobile journey. With no provider access or incomplete inventory, leave the item prepared and record the blocker. A stored sent-post metrics receipt is not a complete future reservation inventory. Copy the approved item unchanged into the existing queue only when eligible, adding the normal fixed `scheduledFor` and `status: queued` through the established flow; retain `contentKind: house-campaign` and `campaignId`. The existing authenticated scheduler validates the exact approved package, then applies its usual live and provider gates. Do not call it separately or use an article identity to bypass approval.

Each existing cycle: produce or select within the approved remit, inspect actual output against accepted requirements and prior feedback, fix mismatches and reverify before handoff. Use available comparable evidence for routine iterations; preserve historical metric/date context and unknowns. Review failures immediately; daily/weekly checks are backstops. New prices, spend or materially different claims need separate approval. A deployment or merged policy is not proof this ordinary publisher has consumed it; report prepared, policy merged, queued, scheduled, sent and verified separately.

Before reserving a future LinkedIn day, read media-policy.json, media-manifest.json and current social-queue.json; use scripts/select-media-slot.cjs with already-qualified article candidates. The queue remains the sole per-day slot ledger. Compare qualified High/Standard news, selective Library analysis and already-prepared verified media together using the reasoned ordering below; there is no automatic classification or format precedence. This adds no article cycle or extra social post. Keep an existing reservation unchanged; never cancel, overwrite or rewrite its content/time merely to fit media. Never select the same canonical destination or underlying parentPublicationId twice.

For a selected media item, preserve the existing linkedin-prefixed immutable ID and articleUrl/distributionUrl compatibility fields; add contentKind:media, mediaAssetId, mediaFormat and parentPublicationId where applicable. Use the verified manifest thumbnail/alt text and the same exact LinkedIn UTMs. All source, rights, accessibility and production gates must pass before queue reservation. News/Library eligibility otherwise remains unchanged. X is blocked. Existing image promotion remains supported. For a completed short video, use `../native-video-handoff.md`: preserve the same immutable queue item, canonical URL, UTMs, shared caps and timing; add mediaType:video, videoUrl and videoSha256 matching the production-verified manifest.nativeVideo. Only the existing verified executor submits one native MP4; no separate publisher or link-plus-image substitution.

Use the fixed times above unless the item matches the exact active timingTest experimentId, mediaFormat and dated assignment in media-policy.json after a validated format baseline. The bounded validator permits only 10:00 ET or that weekday's established midday slot, eight exact dates within six weeks; ordinary items keep fixed midday times. At most one LinkedIn post per weekday/five per week remains mandatory across article and media selections. The existing verified operations workflow alone executes and records receipts; the media coordinator only prepares/hands off.

Prepared, source/rights/accessibility-verified media may claim an otherwise free future queue reservation as status:planned using immutable approved copy, destination, thumbnail, ID and time. The executor ignores planned entries. This prevents the07:00publisher filling the day before08:30media release. Only the publisher promotes that SAME item to queued after matching manifest production verification and live URL/image gates; never enqueue an unpublished destination. A planned reservation that cannot release remains held/blocked with its reason until an explicit policy-preserving release decision; do not silently replace it. Run the selector before any new article reservation, including future days.

Exact planned timing crossover (Eastern): October20 10:00, October22 11:30, October27 11:30, October29 10:00, November3 11:30, November5 10:00, November10 10:00, November12 11:30. Experiment ID:cuai-timing-media-2026-10-20. These are an inactive plan, not currently authorized morning executions. Select one comparable format and verify baseline before activation; if baseline is not ready, retain midday and report the missed test slot. Do not shift the cohort dates, weaken baseline gates, mix formats or invent replacement dates. The runtime accepts only these exact date/time pairs.

## Immediate acceptance before handoff

<!-- cuai-cycle-acceptance-v1 -->
Use the existing agent protocol's immediate acceptance loop for this run: produce, inspect the actual output against the latest accepted direction, references and prior feedback, repair mismatches within scope, and recheck before handoff. Daily/weekly reviews are backstops. Before calling a built output ready, record a capable end-user review of the exact version, separately from its builder where practical, covering normal/error/mobile/accessibility journeys or specific inapplicability, actual observations, fixes and recheck. Tom is not the default tester. Missing access, inspection or unresolved defects block readiness. Tests and supplied pass flags alone cannot certify the journey.

Run `node scripts/check-operational-policy.cjs daily-publisher` with this policy's role (`daily-publisher`, `cuai-operating-system`, or `cuai-media-coordinator`) to record the controlling local policy paths and byte hashes before handoff. This resolves checked-out sources only; it cannot prove Cloud task bootstrap, actual perceptual acceptance, merge, activation or live delivery. On scheduled execution, read the controlling files from authorized main as already required. Private branches and Library snapshots never replace active main. Preserve all existing permission and release gates.
