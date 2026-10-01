# CreditUnionAI News Content Operating System

## Core Publishing Rule
CreditUnionAI News operates in automatic-production mode. Routine articles do not require Tom's approval.

Candidates must pass the source, confidence, originality, and quality hard stops in `automation/publishing-rules.json`. Passing stories publish directly to `main` and Vercel production. Failed candidates are logged with reasons instead of being routed for routine approval.

## Automated Editorial Workflow

1. Gather credible developments from public sources.
2. Normalize candidates using `automation/editorial-taxonomy.json`.
3. Score newsworthiness, credit-union relevance, coverage gaps, originality, source quality, and urgency.
4. Reject candidates that fail a hard stop or minimum score.
5. Select a balanced weekly portfolio across functions, technologies, formats, audiences, and maturity levels.
6. Generate the article, image, metadata, source notes, sitemap entry, and social distribution assets.
7. Run link, markup, metadata, similarity, sourcing, and conflict checks.
8. Commit successful packages directly to `main`; Vercel deploys production automatically.
9. Append the published story to `automation/coverage-ledger.json`.
10. Use the Monday analytics review to recommend adjustments to targets, weights, timing, and content mix.

Infrastructure, templates, and site-wide design changes still use a branch and pull request. The automatic-production rule applies to validated editorial packages.

## Conflict-Safe Rules
- Use public sources only.
- Do not use confidential information from Fiserv, Infinite Solutions, clients, internal conversations, or non-public work exposure.
- Do not imply affiliation with Fiserv or Infinite Solutions.
- Avoid publishing employer/client-specific analysis unless based entirely on public information and framed neutrally.
- Clearly label sponsored content.
- Preserve editorial independence from advertisers and vendors.

## Image and media workflow

Validated routine editorial packages follow the current direct-production article policy. Use the concept-selection and text-free hero rules in IMAGE_GUIDELINES.md. Infrastructure, templates and site-wide changes retain branch/PR review.

## Current publishing targets

The controlling version 6 publishing rules and September 29 publisher expansion target eight qualified full articles per full week: Monday/Wednesday/Friday two, Tuesday/Thursday one; maximum two per weekday. No candidate is published solely to fill a slot. Alerts remain separate with no quota. The website briefing is not an automated email delivery pipeline.

## Approved recurring media — October 1, 2026

Read automation/media-policy.json and automation/scheduled-tasks/cuai-media-coordinator.md. Prepare separate visual modules and source-qualified podcast/video packages at least two business days ahead. Media never replaces an article slot or increments fullArticleCount. The sole LinkedIn executor remains the existing verified workflow; the daily publisher selects media/news inside the shared one-per-weekday/five-per-week cap, preserving all reservations. Keep midday baseline timing; only exact dated timing-test assignments after validated baseline may use 10:00 ET. X remains blocked pending verified identity and authorized routing. Do not add article jobs, paid AI video, subscriptions, credentials or scopes.

## Status Labels
- Idea
- Researching
- Drafting
- Ready for Preview
- Preview Live
- Tom Approved Preview
- Placement Approved
- Published
- Held / Rejected

## Approval Packet Template

```text
Approval request: [Title]

Type: News / Insight / Newsletter / Sponsored / Page update
Recommended publish slot:
Proposed preview branch:
Proposed URL:

Summary:
[2–4 bullets]

Sources:
- [source 1]
- [source 2]

Image:
- concept/file
- alt text

Conflict check:
- Public sources only: Yes/No
- Any Fiserv/Infinite Solutions overlap: Yes/No + note
- Sponsored/vendor relationship: Yes/No + label needed?

Files changed:
- path/to/file.html

Next approval needed:
Preview it / Revise copy / Revise image / Hold / Reject

After Vercel preview is live, Tom can reply:
Approved — article page only / Approved — put on News / Approved — put on Home and News / Revise copy / Revise image / Hold
```

## Current Site Publishing Path
- Repo: `thomaschurchadams-eng/work-feel`
- Hosting: Vercel
- Site type: static HTML/CSS/JS
- Editorial publishing: validated article package → direct commit to `main` → Vercel Production Deployment
- Infrastructure publishing: branch → pull request → merge to `main`

## CUAI Weekly video release placement — September 28, 2026

An approved video launch includes the current episode page, Episodes archive and a homepage feature above the long news feed. Replace the prior homepage feature rather than accumulating cards; preserve older episodes in the archive. Include a story-led headline, thumbnail, week-ending date, measured runtime and Watch CTA. No autoplay. Verify desktop/mobile discovery, destination, captions and sources before marking the release complete.

Promotional copy leads with CUAI journalism, not voice-provider or preset names. Keep Sarah/ElevenLabs settings in internal production records. Retain plain AI-narration transparency in episode credits and applicable platform disclosures; preserve all required asset credits. Do not impersonate a human reporter.

Use existing GA4 cuai_weekly_click (episode_id, placement, link_type) for homepage CTA clicks; no internal UTM tags, personal data or new services. Record comparable seven-day episode visits and platform retention when actually available, keeping internal checks separate and missing data unknown. Click instrumentation is not proof of analytics ingestion. The permanent Production Bible and weekly prompt remain in Pineview; this rule ensures website publishers preserve episode discovery. This does not grant future video publishing approval.

Exact planned timing crossover (Eastern): October20 10:00, October22 11:30, October27 11:30, October29 10:00, November3 11:30, November5 10:00, November10 10:00, November12 11:30. Experiment ID:cuai-timing-media-2026-10-20. These are an inactive plan, not currently authorized morning executions. Select one comparable format and verify baseline before activation; if baseline is not ready, retain midday and report the missed test slot. Do not shift the cohort dates, weaken baseline gates, mix formats or invent replacement dates. The runtime accepts only these exact date/time pairs.
