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

**NS1 — Become the most useful and trusted AI intelligence source for credit-union leaders.**

Interpret "useful" as qualified readership and evidence of substantive engagement, not raw impressions. Interpret "trusted" as strong sourcing, accurate framing, clear credit-union relevance, and reliable production/distribution.

## Current 30-day goals

### G1 — Establish and improve qualified readership

**Outcome:** More credit-union leaders reach and consume CUAI content, with a trustworthy measurement baseline.

**September target:** Establish a reliable qualified-readership baseline from the canonical GA4 reporting path as early in the cycle as data allows, then finish September with directional improvement in qualified readership versus that baseline. Use 7-day and 28-day views appropriately; do not manufacture a percentage target when the baseline is not yet trustworthy.

**Primary evidence:** GA4 endpoint users/sessions, page performance, 90%-scroll users, acquisition/source-medium, LinkedIn-attributed sessions, and Search Console when available.

**Guardrails:** Do not trade sourcing quality, editorial relevance, or coverage breadth for traffic. Never treat Buffer impressions as site readership.

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

## Current priority order

1. **G3 — Prove the autonomous operating loop** while the new agent bus is being validated in live cycles.
2. **G1 — Establish and improve qualified readership.**
3. **G2 — Prove at least one engagement improvement.**

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

## Month-end reset

During the final CEO review of September, assess each goal as `achieved | partial | missed | superseded`, record the evidence, and propose the next short operating cycle. Do not automatically roll the same goals forward or create another 90-day period without Tom's approval.
