# Rendered design acceptance

Start the ordinary publisher with `npm run check:browser` before research/image work.
It records actual pinned-browser launch, 390/1440 smoke rendering, revision and
cache fingerprints in `design-results/browser-preflight.json`. It installs or
deletes nothing and is not full site acceptance. The normal `test:design` command
also runs it automatically. Missing browser or cache mutation fails closed.

The existing read-only PR job is the fallback when the publisher's runtime cannot
launch. Its ephemeral job-local cache avoids sharing the publisher's default
cache; it does not establish isolation between other local worktrees. Exact PR
head and base are recorded. Normal rendered coverage always includes the newest
News and Insight plus all changed article paths relative to the PR base, without
removing baseline routes, accessibility, card-artwork404/recovery, Alerts or
analytics journeys. For local candidate work use
`CUAI_DESIGN_ARTICLE_PATHS=news/exact-slug.html npm run test:design`.
Review `review-input.json`, `results.json`, `review-completion.json`, the artwork
receipt and actual desktop/mobile screenshots against the exact revision before
release. Missing artifacts or a changed revision invalidate acceptance. Smoke and
unit fixtures are not a substitute. `reliability-watch` owns incident triage;
`daily-publisher` retains sole article/release ownership. Preserve the original
incident key and today's completed publication/social outcome.

Run `npm ci`, `npx playwright-core install chromium`, and `npm run test:design`.
The test starts its own loopback static server unless `CUAI_DESIGN_BASE_URL` is set
to the exact review Preview. `CUAI_BROWSER_EXECUTABLE` can point to an existing
Chrome executable. It never submits forms, plays media, calls a private endpoint
or sends analytics. External frames/analytics are blocked in automated checks;
their real playback and delivery remain separate acceptance responsibilities.

The existing CUAI operations workflow runs this read-only job on design-relevant
pull requests. It produces desktop/mobile screenshots and JSON accessibility,
geometry and interaction results. There is no new scheduled monitor and no
change to trusted production/provider execution.

`contracts.json` is the reviewed semantic/geometry baseline. A test run cannot
update it. Changes require an explicit PR explanation and review of before/after
screenshots on the real Vercel Preview. Screenshots are review artifacts, not
automatically accepted pixel goldens: operating-system fonts and current content
vary. No job commits changed baselines or approves its own visual evidence.

For shared CSS, shell, templates or JS changes, inspect Home, Topics/detail,
article/listing, media, briefing, contact and tracker screenshots at desktop and
mobile. Review long headings at320/1024px, both existing sponsor variants, prose
rhythm, image crops, focus and journeys on the actual Preview before release.
Keep commercial placements and publication gates unchanged. Passing automation
does not replace this review or establish complete WCAG conformance.

The publisher can run `npm run check:design` and bounded affected-route rendered
checks before its existing handoff. New pages must use the shared shell and
heading roles via `node scripts/sync-site-design.mjs`; no publisher schedule or
Cloud task prompt is changed by this implementation.

## Acceptance in the current cycle

Include a first-time visitor copy review: for each instruction or disclaimer, identify the decision, action or material limit it clarifies. Remove redundant mechanics, implementation notes and repeated statements; keep substantive commercial, privacy, editorial and evidence disclosures. Inspect the actual page after a control or destination changes, including nearby copy that may now duplicate its label. Tests should verify the real destination, availability/confirmation boundary and rejected-boilerplate regressions; they must not require an unnecessary sentence merely because it existed before. Record concrete edits and recheck desktop/mobile with the current version in the existing review receipt.

Apply the existing agent protocol's immediate output acceptance before handing off a built output. Inspect actual desktop/mobile journeys against the latest direction, references and prior feedback; record the exact version, reviewer, normal/error/accessibility observations, defects, scoped fixes and recheck. Use a separate capable reviewer where practical; Tom is not the default tester. An inaccessible or blank HTTP200 preview is not ready. For tools verify arithmetic and privacy; mocks and dry-run analytics cannot establish live payment/API/GA delivery. Screenshots and unit tests alone do not establish usefulness or perceptual creative acceptance. Keep observations with the existing asset/project evidence. Daily/weekly checks are backstops, not a deferred repair plan.

Product-specific private readiness engines remain with their product candidates; this operational-only integration does not add or release the private Decision Tools app. The existing sitewide design command retains its route scope and cannot certify private product or hosted scheduled-task activation.

## Approved mobile and measurement journeys

The normal rendered command also runs `verify-analytics-journeys.cjs` for the PSECU/Plaid mobile openings, keyboard pilot-question links, genuine related destinations and the Briefings email-request boundary. The existing Alerts harness retains full-archive search, empty/recovery, recent filter, keyboard, pagination and accessibility checks. All QA traffic is isolated; source preflights, browser tests and caller-supplied aggregate exclusions do not prove hosted GA delivery, genuine subscription confirmation, CAI fulfillment or external customer demand. Keep the actual independent version-bound walkthrough with this change's existing review receipts.
