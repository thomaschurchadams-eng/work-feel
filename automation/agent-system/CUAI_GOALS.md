# CUAI Goals — Authoritative Goal Hierarchy

## Authority and review window

This file defines the goals that the CreditUnionAI News agent organization is trying to achieve. It answers **why** work should be done; role policies and approval boundaries still control **what agents may do**.

**Owner:** Tom  
**Operating owner:** `cuai-ceo`  
**Initial 90-day window:** 2026-08-31 through 2026-11-29  
**Review cadence:** CEO reviews progress weekly; Tom reviews or changes top-level goals when needed.

The CEO may update baselines, progress, confidence, and evidence in management reporting. It may propose goal changes, but it must not silently change a goal's intent, target, review date, or guardrails. Any material goal change requires Tom.

## North Star

**NS1 — Become the most useful and trusted AI intelligence source for credit-union leaders.**

Interpret "useful" as qualified readership and evidence of substantive engagement, not raw impressions. Interpret "trusted" as strong sourcing, accurate framing, clear credit-union relevance, and reliable production/distribution.

## 90-day goals

### G1 — Grow qualified readership

**Outcome:** More credit-union leaders reach and consume CUAI content.

**Provisional target:** By 2026-11-29, increase both 28-day site users and 90%-scroll users by at least 25% versus the first complete 28-day baseline available after 2026-08-31.

**Primary evidence:** GA4 endpoint users/sessions, page performance, 90%-scroll users, acquisition/source-medium, and Search Console when available.

**Guardrails:** Do not trade sourcing quality, editorial relevance, or coverage breadth for traffic. Never treat Buffer impressions as site readership.

### G2 — Increase useful engagement and conversion intent

**Outcome:** Readers do something that indicates the content helped them: read deeply, continue to related material, inspect sources, or express newsletter/return intent.

**Provisional target:** Improve the combined rate of substantive editorial actions per session by at least 20% versus the first complete baseline available after 2026-08-31. Use only events actually available in the canonical analytics endpoint; document the exact event set used for the baseline and keep it consistent unless measurement is intentionally improved.

**Primary evidence:** 90%-scroll users, related-content clicks, source clicks, newsletter-intent activity, article views, and other established CUAI editorial events.

**Guardrails:** Do not optimize for shallow clicks, sensational framing, or repetitive high-performing topics at the expense of important coverage.

### G3 — Make CUAI reliably autonomous

**Outcome:** Routine publishing, distribution, measurement, recovery, and cross-agent coordination operate without Tom unless an existing approval boundary is reached.

**Provisional target:** Across the 90-day window, at least 95% of scheduled weekday article cycles leave a valid machine-observable outcome; no duplicate LinkedIn posts; no material editorial/sourcing-gate breach; and at least 90% of routine internal handoffs requiring no Tom approval are completed or explicitly blocked/superseded without Tom intervention.

**Primary evidence:** `automation/daily-cycle-state.json`, `automation/social-queue.json`, Reliability Watch outcomes, issue #160 agent-bus events, and `automation/cuai-usage-ledger.json`.

**Guardrails:** Autonomy never expands external authority. Tom approval remains required wherever existing policies require it.

## Current priority order

1. **G3 — Reliable autonomy** until the agent bus and handoffs have completed enough live cycles to be trusted.
2. **G1 — Qualified readership growth.**
3. **G2 — Useful engagement and conversion intent.**

The CEO may change the *operating priority order* when evidence shows a different constraint, but it must record the reason and may not change the goals themselves without Tom.

## Goal-driven operating loop

Every material CEO decision or cross-functional assignment should answer:

1. **Which `goalId` is constrained?**
2. **What evidence shows the constraint?**
3. **What is the smallest reversible action likely to improve it?**
4. **Who owns the action?**
5. **What measure will show whether it worked?**
6. **When will the CEO review it?**

Agent-bus assignments and material handoffs should include `goalId:` using `G1`, `G2`, `G3`, or `NS1` when directly relevant. Work with no credible connection to a current goal should normally not be created.

## Baseline rule

When a target lacks a trustworthy baseline, the first action is to establish the baseline from authoritative data. Missing data is not zero. If measurement is unavailable, the CEO may open one bounded measurement-quality assignment before opening optimization work dependent on that metric.
