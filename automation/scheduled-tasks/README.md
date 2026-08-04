# CreditUnionAI News Cloud Task Policies

These files are the durable, source-controlled policies for the two existing ChatGPT Cloud scheduled tasks.

## One-time Cloud task bootstrap

- **Publish CUAI Daily Article:** Before each run, read `automation/scheduled-tasks/publish-cuai-daily-article.md` from `main` and treat it as controlling.
- **CUAI Operating System:** Before each run, read `automation/scheduled-tasks/cuai-operating-system.md` from `main` and treat it as controlling.

Schedules, model selection, permissions, and delivery configuration remain in the Cloud tasks; they are not defined or changed by these repository policy files.
