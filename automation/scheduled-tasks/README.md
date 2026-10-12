# CreditUnionAI News Cloud Task Policies

These files are the durable, source-controlled policies for the existing article/operating tasks and approved media preparation handoff.

## One-time Cloud task bootstrap

- **Publish CUAI Daily Article:** Before each run, read `automation/scheduled-tasks/publish-cuai-daily-article.md` from `main` and treat it as controlling.
- **CUAI Operating System:** Before each run, read `automation/scheduled-tasks/cuai-operating-system.md` from `main` and treat it as controlling.

Schedules, model selection, permissions, and delivery configuration remain in the Cloud tasks; they are not defined or changed by these repository policy files.

- **CUAI Media Coordinator:** Parent-managed single weekday preparation schedule reads cuai-media-coordinator.md, media-policy.json, media-manifest.json and current shared queue. This file creates no schedule and no second social executor.
