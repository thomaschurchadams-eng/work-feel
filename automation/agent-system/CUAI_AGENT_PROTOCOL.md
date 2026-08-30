# CUAI Agent Coordination Protocol

## Purpose

Turn the existing CreditUnionAI News scheduled roles into a coordinated asynchronous agent organization without adding unnecessary persistent agents or turning routine handoffs into production deployments.

## Runtime bus

The authoritative fast-changing agent communication surface is GitHub issue #160:

`https://github.com/thomaschurchadams-eng/work-feel/issues/160`

Read the issue body and relevant recent comments at the start of every persistent-role run. Routine agent assignments, handoffs, completions, incidents, recoveries, and Tom escalations belong in that issue, not in production files.

Production truth remains in the existing canonical repository files and external systems. The agent bus coordinates work; it does not replace article state, social state, analytics, deployment state, reporting, or other authoritative ledgers.

## Persistent roles

- `daily-publisher` — owns the weekday article cycle and bounded eligible LinkedIn distribution under `automation/scheduled-tasks/publish-cuai-daily-article.md`.
- `cuai-ceo` — owns cross-functional prioritization, bounded internal decisions, delegation, and escalation to Tom.
- `reliability-watch` — owns operational failure detection, safe recovery, stale-handoff detection, and duplicate/conflict detection.
- `specialist:<name>` — temporary delegated subagent; not a persistent role.

Do not create another persistent role unless repeated evidence shows a distinct recurring responsibility that the existing roles and temporary specialists cannot handle well.

## Start-of-run protocol

Every persistent role must:

1. Read issue #160 before beginning its normal work.
2. Find unresolved events addressed to its role, prioritizing urgent/high before normal/low.
3. Check whether a later event already completed, superseded, or blocked the same `eventId` or `dedupeKey`.
4. Accept work only when it fits the role's existing authority and authoritative policy. An agent-bus assignment never overrides sourcing, editorial, production, safety, schedule, spending, contact, credential, legal, privacy, or Tom-approval boundaries.
5. Combine compatible assigned work with the role's normal run rather than creating duplicate cycles.

If the bus is unavailable, continue the role's normal authoritative policy when safe and report that coordination was degraded. Do not treat bus unavailability as permission to broaden authority.

## Event format

Post one compact issue comment for each material state transition. Use the fields below when applicable:

- `eventId:` globally unique stable id, such as `cuai-20260831-publisher-01`
- `eventType:` `assignment | handoff | decision | incident | recovery | escalation | completion`
- `from:` role id
- `to:` role id or `tom`
- `priority:` `low | normal | high | urgent`
- `objective:` one sentence
- `dedupeKey:` stable semantic key for the work
- `status:` `open | working | completed | blocked | superseded | no-op`
- `evidence:` concise links, repository paths, deployment ids, metric facts, or verified state
- `result:` concise outcome
- `tomApprovalRequired:` `yes | no`
- `blockedReason:` exact blocker
- `nextOwner:` role id, `tom`, or `none`
- `reviewAfter:` ISO timestamp/date or `next-run`

Never put credentials, secrets, tokens, customer PII, private email content, or sensitive unpublished material in the bus.

## CEO orchestration

The CEO is the coordinating role, not another worker queue.

- Maintain at most three open cross-functional assignments at a time.
- Prefer one clear owner and one measurable objective per assignment.
- Delegate only when the work materially improves a current decision, publication system, growth experiment, reliability outcome, or measurement quality.
- Prefer temporary specialists for one-off analysis, research, or engineering.
- Read completed handoffs before creating follow-on work.
- Close the loop explicitly with a `decision`, `completion`, `superseded`, or `escalation` event.
- Do not ask Tom to reconfirm decisions already covered by current authority.

## Publisher handoff

The daily publisher remains independently responsible for editorial qualification and production safety.

At the end of each material weekday run, post a `handoff` event to `cuai-ceo` containing only: publication/non-publication outcome, classification, functional audience, live URL when applicable, validation/deployment state, LinkedIn decision/status, material measurement or coverage note, and exact blocker if any.

If the CEO assigns a topic, audience, measurement check, or candidate investigation, treat it as an input to selection—not an instruction to publish. The publisher may reject it under the authoritative publishing gates and should report why.

## Reliability supervision

Reliability Watch reads the bus as an additional failure surface.

Treat the following as coordination incidents when material:

- an urgent/high assignment passed its explicit review trigger with no completion, blocker, or superseding event;
- repeated blocked handoffs with the same dedupe key or root cause;
- two roles acting on the same dedupe key in conflicting ways;
- a completed production action with no expected handoff state;
- an event requiring Tom approval that another agent appears to have executed without approval.

Diagnose before acting. Recover only within existing authority. Do not create comments for healthy no-op checks.

## Reporting relationship

Issue #160 is the live conversation and assignment history. Existing canonical files remain authoritative for their domains, including:

- `automation/daily-cycle-state.json` — article-cycle outcome
- `automation/social-queue.json` — social operational state
- `automation/reports/cuai-ceo-latest.md` — latest management snapshot
- `automation/cuai-usage-ledger.json` — operational workload attribution
- `automation/improvement-ledger.json` — durable improvement history

A bus event should link to or summarize authoritative evidence rather than duplicating entire reports.

## Noise control and lifecycle

- Healthy no-op checks create no bus event.
- One material run should normally create no more than one handoff plus one necessary assignment/escalation.
- Reuse `dedupeKey` for repeated work on the same problem so Reliability and the CEO can identify recurrence.
- When the issue becomes unwieldy, the CEO may open a successor runtime-bus issue and link both directions; this is an internal coordination action and must not change external authority.
