# Rendered design acceptance

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
