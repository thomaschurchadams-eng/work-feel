# CUAI Agent Reporting Contract

## Purpose

Make CreditUnionAI News agent work visible, auditable, and easy to inspect from GitHub or the Codex desktop workspace without relying on ChatGPT task history.

## Persistent-role coordination

Every persistent CUAI role that uses this reporting contract must also read all three coordination surfaces at the start of its run:

- `automation/agent-system/CUAI_GOALS.md` — authoritative North Star, current operating goals, priority order, commercial/editorial guardrails, and month-end reset;
- `automation/agent-system/CUAI_AGENT_PROTOCOL.md` — coordination rules;
- GitHub issue #160 (`https://github.com/thomaschurchadams-eng/work-feel/issues/160`) — live assignments, handoffs, decisions, incidents, recoveries, completions, and Tom escalations.

Routine coordination belongs in issue #160 rather than production files so agent communication does not create unnecessary Vercel deployments.

The goal hierarchy and bus add prioritization and coordination only. They never override the role's authoritative publishing, editorial, reliability, commercial-disclosure, external-action, spending, privacy, credential, schedule, or Tom-approval boundaries. Existing domain ledgers remain authoritative for production truth.

The `cuai-ceo` should identify the most constrained current goal from verified evidence before opening new discretionary work, assign bounded cross-functional work with `goalId` and `successMeasure`, and close the loop on completed handoffs. It should treat G4 revenue and G5 CAI growth as real company goals rather than optional side projects, while preserving the commercial/editorial firewall. `reliability-watch` should treat materially stale, duplicated, conflicting, repeatedly blocked, or firewall-breaching bus handoffs as an additional reliability signal; reliability work normally protects `G3` unless another goal is directly affected. Healthy no-op reliability checks should not create bus comments.

## Canonical management report

The latest management view lives at:

`automation/reports/cuai-ceo-latest.md`

The CUAI CEO must refresh this file on each successful weekday CEO run. It is a rolling snapshot, not an append-only log.

Required sections:

- `As of` — ISO timestamp in America/New_York context.
- `Goal progress` — current operating goal priority, strongest verified progress signal, most constrained goal, and any baseline/target still unavailable.
- `System health` — healthy, degraded, or blocked, with concrete evidence.
- `Newsroom output` — latest article outcome, classification, live URL when present, validation/deployment state, and LinkedIn decision/status.
- `Reliability` — incidents detected, recoveries completed, unresolved blockers, repeated failure patterns, and material agent-bus handoff failures when present.
- `Audience growth` — G1 progress using trustworthy site/audience evidence, not impression substitutes.
- `Engagement learning` — G2 experiment state and strongest substantive behavior signal.
- `Revenue` — G4 monetization package/pipeline/revenue state, verified commercial evidence, and exact approval blocker when external action is required.
- `CAI growth` — G5 attributable CUAI→CAI sessions, intent/leads, promotional-surface status, and measurement quality.
- `Process evolution` — low-risk improvements made, experiments opened/closed, before/after behavior, and rollback instructions when a change was implemented.
- `Delegated work` — specialist subagents, focused investigations, and material open/completed agent-bus assignments used in the run and their outcome, with `goalId` when applicable.
- `Tom decision required` — only items that exceed existing authority or need access/approval. Write `None` when there is nothing to escalate.

Keep this report concise enough to review in roughly five minutes.

## Usage ledger

The canonical CUAI activity ledger lives at:

`automation/cuai-usage-ledger.json`

This ledger is an operational attribution record, not a claim of exact OpenAI token or credit consumption. OpenAI plan usage may not expose exact per-task cost, so the ledger records observable workload that can be correlated with the native ChatGPT/Codex Usage dashboard.

Each material CUAI agent run should append one entry containing:

- `timestamp`
- `actor` — e.g. `daily-publisher`, `cuai-ceo`, `reliability-watch`, or a named specialist subagent role
- `runType` — scheduled, recovery, delegated-research, delegated-engineering, delegated-analysis, delegated-commercial, or manual
- `trigger`
- `status` — success, no-op, recovered, degraded, or blocked
- `workUnits` — counts when known: searches, candidate evaluations, files changed, commits, deployments checked, social scheduling attempts, commercial opportunities evaluated, specialist subagents spawned
- `externalSystemsTouched` — e.g. GitHub, Vercel, Buffer, Google Analytics, Search Console, CAI analytics/commerce sources when accessed
- `summary`
- `usageAttribution` — always `operational-proxy` unless exact native per-run usage is actually retrieved from an authoritative OpenAI source

Do not invent token counts, credit counts, percentage-of-plan figures, cost estimates, revenue, sponsor pipeline, or CAI lead counts.

### Large-ledger safe append

When the available writer replaces the complete file, never reconstruct `automation/cuai-usage-ledger.json` from a truncated snippet. Resolve the exact current ledger blob SHA and retrieve the complete Git blob before preparing the replacement. If complete retrieval succeeds, append against that complete blob, re-read `main` immediately before writing, and preserve every pre-existing entry. If complete retrieval is unavailable or the blob SHA changed and cannot be safely reconciled, leave the ledger unchanged and report the exact blocker rather than degrading automatically to a truncated whole-file write.

## Reporting discipline

1. Prefer existing evidence and current repository state over memory.
2. Record no-op watchdog checks compactly; do not create noisy commits for every healthy hourly/polling check. The Reliability Watch should write only when it detects/recovers a material issue, when a recurring failure pattern changes, or when the reporting/usage ledger needs a meaningful state transition.
3. The CEO may aggregate multiple watchdog no-op checks into one daily usage entry rather than writing one repository commit per check.
4. Preserve concurrent changes. Re-read `main` before writing.
5. Use narrow, reversible changes. Never let reporting or agent-bus changes alter editorial or publishing authority.
6. If GitHub writing is blocked, return the exact reporting blocker in the task result rather than silently omitting the report.
7. Use issue #160 for routine cross-agent coordination; do not create a repository commit merely to record an assignment or handoff.
8. Do not create discretionary work that lacks a credible link to a current goal, reliability obligation, editorial duty, or required control.
9. Commercial and CAI-growth reporting must preserve the editorial firewall and distinguish paid/house promotion from independent editorial performance.

## Codex desktop usage

When the `work-feel` repository is open in Codex, the user can ask for the current CUAI management view by referencing `automation/agent-system/CUAI_GOALS.md`, `automation/reports/cuai-ceo-latest.md`, `automation/cuai-usage-ledger.json`, and issue #160. These are the shared goal, management, and coordination surfaces between ChatGPT scheduled agents and Codex.