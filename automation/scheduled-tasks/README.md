# CreditUnionAI News Cloud Task Policies

These files are the durable, source-controlled policies for the existing article/operating tasks and approved media preparation handoff.

## One-time Cloud task bootstrap

- **Publish CUAI Daily Article:** Before each run, read `automation/scheduled-tasks/publish-cuai-daily-article.md` from `main` and treat it as controlling.
- **CUAI Operating System:** Before each run, read `automation/scheduled-tasks/cuai-operating-system.md` from `main` and treat it as controlling.

Schedules, model selection, permissions, and delivery configuration remain in the Cloud tasks; they are not defined or changed by these repository policy files.

- **CUAI Media Coordinator:** Parent-managed single weekday preparation schedule reads cuai-media-coordinator.md, media-policy.json, media-manifest.json and current shared queue. This file creates no schedule and no second social executor.

## Current-cycle acceptance and checked-out preflight

The controlling shared acceptance procedure is `automation/agent-system/CUAI_AGENT_PROTOCOL.md`; native-video release gates remain in `automation/native-video-handoff.md`; rendered site acceptance remains in `tests/design/README.md`. Each role retains its existing policy above. The source-of-truth map indexes these files; exports, private branches and Library snapshots do not replace main.

Before handoff, use `node scripts/check-operational-policy.cjs <role>` for `daily-publisher`, `cuai-operating-system`, or `cuai-media-coordinator` to record the local controlling sources and byte hashes. Existing PR design checks run all three preflights. This is source resolution, not proof of actual creative/end-user review, scheduled consumption or live delivery. Existing Cloud bootstraps still must read authorized main before each run.

The full media production runner/Swift renderer and its structural end-user gate remain PRIVATE in their existing owner's candidate. They are not installed or activated by this operational change. Likewise the Decision Tools app and its required browser/UX readiness engine remain in their private product branch; this change does not publish them. Existing per-asset receipts remain authoritative for actual observations, versions, defects, fixes and recheck. No new tracker, schedule, model or publisher is created.
