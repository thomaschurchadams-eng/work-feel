# CUAI Goals — Authoritative Goal Hierarchy

## Authority and review window

This file defines the goals that the CreditUnionAI News agent organization is trying to achieve. It answers **why** work should be done; role policies and approval boundaries still control **what agents may do**.

**Owner:** Tom  
**Operating owner:** `cuai-ceo`  
**Current operating cycle:** 2026-08-31 through 2026-09-30  
**Review cadence:** CEO reviews progress weekly; Tom reviews or changes top-level goals when needed. At the end of the cycle, close, carry forward, or replace each goal based on evidence.

The CEO may update baselines, progress, confidence, and evidence in management reporting. It may propose goal changes, but it must not silently change a goal's intent, target, review date, or guardrails. Any material goal change requires Tom.

The North Star is durable. The operating goals below are intentionally short-cycle and should normally be reset monthly rather than treated as a new 90-day planning period.

## North Star

**NS1 — Become the most useful, trusted, commercially sustainable AI intelligence source for credit-union leaders and a meaningful growth engine for CAI.**

Interpret "useful" as qualified readership and evidence of substantive engagement, not raw impressions. Interpret "trusted" as strong sourcing, accurate framing, clear credit-union relevance, and reliable production/distribution. Commercial activity must remain clearly separated from editorial judgment.

## Current 30-day goals

### G1 — Grow qualified audience aggressively

**Outcome:** CUAI reaches materially more credit-union leaders and functional decision makers.

**September target:** If the August 31 28-day GA4 baseline is trustworthy, increase qualified site users by at least 50% by the final comparable September measurement window, while also improving or maintaining deep-read quality such as 90%-scroll behavior. If the 28-day baseline is not trustworthy, establish a valid baseline no later than the first week of September and target at least 50% growth in the final complete 7-day qualified-user window versus the first complete 7-day baseline. The CEO may use Search Console, LinkedIn-attributed sessions, direct/return behavior, and content cohorts to diagnose the growth constraint.

**Primary evidence:** GA4 endpoint users/sessions, qualified article views, 90%-scroll users, acquisition/source-medium, LinkedIn-attributed sessions, return behavior where available, and Search Console.

**Guardrails:** Do not trade sourcing quality, editorial relevance, or coverage breadth for traffic. Never treat Buffer impressions as site readership. Growth tactics must remain consistent with CUAI's editorial trust.

### G2 — Prove at least one engagement improvement

**Outcome:** Identify and retain at least one bounded editorial, distribution, or conversion change that measurably improves substantive reader behavior.

**September target:** Run no more than two active experiments at once and, by 2026-09-30, have at least one completed experiment with an evidence-backed keep/revise/stop decision. A "keep" requires directional improvement in a substantive engagement measure versus its valid comparison period; activity alone does not count.

**Primary evidence:** 90%-scroll users, related-content clicks, source clicks, newsletter-intent activity, article views, attributed sessions, and other established CUAI editorial events.

**Guardrails:** Do not optimize for shallow clicks, sensational framing, or repetitive high-performing topics at the expense of important coverage.

### G3 — Prove the autonomous operating loop

**Outcome:** Routine publishing, distribution, measurement, recovery, and cross-agent coordination operate without Tom unless an existing approval boundary is reached.

**September target:** At least 95% of scheduled weekday article cycles leave a valid machine-observable outcome; no duplicate LinkedIn posts; no material editorial/sourcing-gate breach; and at least 90% of routine internal agent-bus handoffs requiring no Tom approval are completed, explicitly blocked, or superseded without Tom intervention. Complete enough live bus cycles to make a keep/revise decision on the coordination design by month-end.

**Primary evidence:** `automation/daily-cycle-state.json`, `automation/social-queue.json`, Reliability Watch outcomes, issue #160 agent-bus events, and `automation/cuai-usage-ledger.json`.

**Guardrails:** Autonomy never expands external authority. Tom approval remains required wherever existing policies require it.

### G4 — Build CUAI's own revenue engine

**Outcome:** CUAI begins funding itself through credible commercial products such as sponsorships, advertising, sponsored placements, research partnerships, events, or other audience-appropriate revenue streams.

**September target:** Define a commercially coherent first monetization package with inventory, buyer profile, value proposition, delivery/measurement method, and clearly labeled pricing assumptions; build a qualified sponsor/advertiser opportunity pipeline; and secure at least one paid sponsorship, advertising booking, or equivalent directly attributable CUAI commercial revenue event by month-end if the required external outreach/commitment approvals are granted. If approval is the blocker, the CEO must escalate the smallest specific approval needed rather than substituting internal busywork.

**Primary evidence:** Verified sponsor/advertiser inquiries, approved outreach responses, proposals, bookings, payment records, campaign delivery evidence, and attributable revenue.

**Guardrails:** Sponsorship or advertising must never buy favorable coverage, suppress negative coverage, determine editorial selection, or be disguised as independent journalism. Paid content and house promotion must be clearly labeled. Agents must obtain Tom approval before external outreach, pricing commitments, contracts, spending, or other actions already outside their authority.

### G5 — Make CUAI a measurable growth channel for CAI

**Outcome:** CUAI does not merely coexist with CAI; it sends relevant credit-union leaders into CAI's commercial funnel while preserving CUAI's editorial independence.

**September target:** Establish or verify at least one recurring, clearly labeled CUAI-to-CAI promotional surface with end-to-end UTM/analytics attribution; generate at least 25 qualified CAI site sessions attributable to CUAI and at least one qualified CAI lead, Early Access intent, buyer inquiry, or equivalent commercial-intent event attributable to CUAI by month-end. If current measurement cannot support those figures, repairing the attribution path becomes the first bounded action.

**Primary evidence:** CUAI outbound click events, tagged CAI sessions, CAI funnel/intake events, attributable inquiries, and commercial-intent evidence.

**Guardrails:** CAI promotion must be visibly distinct from independent editorial coverage. CUAI must not distort news selection or factual framing to favor CAI. Do not imply independent endorsement where CUAI and CAI share ownership.

## Current priority order

1. **G3 — Prove the autonomous operating loop** while the new agent bus is being validated in live cycles.
2. **G1 — Grow qualified audience aggressively.**
3. **G5 — Make CUAI a measurable growth channel for CAI.**
4. **G4 — Build CUAI's own revenue engine.**
5. **G2 — Prove at least one engagement improvement.**

The CEO may change the *operating priority order* when evidence shows a different constraint, but it must record the reason and may not change the goals themselves without Tom.

## Goal-driven operating loop

Every material CEO decision or cross-functional assignment should answer:

1. **Which `goalId` is constrained?**
2. **What evidence shows the constraint?**
3. **What is the smallest reversible action likely to improve it?**
4. **Who owns the action?**
5. **What measure will show whether it worked?**
6. **What approval boundary applies?**
7. **When will the CEO review it?**

Agent-bus assignments and material handoffs should include `goalId:` using `G1`, `G2`, `G3`, `G4`, `G5`, or `NS1` when directly relevant. Work with no credible connection to a current goal should normally not be created.

## Baseline rule

When a target lacks a trustworthy baseline, the first action is to establish the baseline from authoritative data. Missing data is not zero. If measurement is unavailable, the CEO may open one bounded measurement-quality assignment before opening optimization work dependent on that metric.

## Commercial/editorial firewall

CUAI may monetize its audience and promote CAI, but commercial goals never override editorial standards.

- Editorial selection, sourcing, factual framing, corrections, and criticism remain independent of sponsors, advertisers, and CAI commercial interests.
- Paid/sponsored content and CAI house promotion must be clearly labeled and analytically separable from ordinary editorial content.
- Commercial performance may influence where CUAI invests in distribution, formats, and product packaging, but never whether a materially important story is covered accurately.
- Any conflict between commercial goals and editorial trust is resolved in favor of editorial trust and escalated to Tom when material.

## Month-end reset

During the final CEO review of September, assess each goal as `achieved | partial | missed | superseded`, record the evidence, and propose the next short operating cycle. Do not automatically roll the same goals forward or create another 90-day period without Tom's approval.
