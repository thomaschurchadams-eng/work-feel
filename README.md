# CreditUnionAI News Static Site

A responsive, multi-page static site for **CreditUnionAI News** with shared navigation, footer, and consistent styling across Home, News, Episodes, Insights, Newsletter, and About pages.

## Preview locally

Quickest path (uses Python, preinstalled on most systems):

1. From the project root, start a lightweight server:
   ```bash
   python3 -m http.server 8000
   ```
2. Open http://localhost:8000/ in your browser. You can click between `index.html`, `news.html`, `episodes.html`, `insights.html`, `newsletter.html`, and `about.html` from the nav bar.
3. Stop the server with `Ctrl+C` when finished.

If you prefer a different port, change `8000` above and open that port in the URL instead.

## File map
- `index.html` — Home hero, latest news highlights, latest episode card, and mission statement
- `news.html` — News feed with curated cards and optional tag filter UI (placeholder)
- `episodes.html` — Podcast episode cards with durations and play buttons (UI only)
- `insights.html` — Insight/article cards with tags and links
- `newsletter.html` — Signup form with inline “Subscribed!” confirmation message
- `about.html` — What we do, who it’s for, and how it works overview
- `assets/styles.css` — Shared styling, layout, typography, and responsive behavior
- `assets/app.js` — Mobile nav toggle, active link highlighting, and newsletter submit handler

## Blueprint: Fully autonomous AI team for site + content operations

If you want this site to run with minimal human input, build a **multi-agent system** where each AI has a narrow responsibility and a hard approval boundary.

### 1) Define your agent roles (single owner per task)

- **Orchestrator (manager agent)**
  - Reads daily goals/KPIs.
  - Creates task plans and assigns work to specialized agents.
  - Handles retries, fallbacks, and escalation rules.
- **Research agent**
  - Collects source material from trusted feeds (regulatory updates, market news, competitor activity).
  - Ranks source quality and flags low-confidence claims.
- **Editorial planner agent**
  - Creates weekly editorial calendar.
  - Chooses formats: news post, insight article, newsletter, episode synopsis.
- **Writer agent**
  - Produces first drafts using your style guide and SEO constraints.
- **Fact-check + compliance agent**
  - Verifies claims against source links.
  - Applies legal/compliance checks (finance wording, disclaimers, prohibited claims).
- **Publisher agent**
  - Converts approved drafts into this repo’s page templates.
  - Opens PRs with changed HTML content and metadata.
- **QA agent**
  - Runs link checks, HTML validation, and style consistency checks before merge.
- **Growth/analytics agent**
  - Reviews traffic/newsletter metrics and recommends content strategy updates.

### 2) Build the control loop

Use a time-based cycle (for example: hourly for monitoring, daily for publishing).

1. **Ingest**: pull new stories/signals from source APIs + RSS.
2. **Plan**: prioritize by audience fit + freshness + business goals.
3. **Draft**: generate content with strict structure prompts.
4. **Verify**: require citations and confidence scores.
5. **Publish**: create branch + commit + PR to this repository.
6. **Measure**: capture pageviews, CTA clicks, newsletter signups.
7. **Learn**: update prompts/rubrics based on KPI outcomes.

### 3) Put guardrails in front of autonomy

- **Policy as code**: encode brand, legal, and editorial rules in machine-checkable validators.
- **Risk tiers**:
  - Low risk (formatting, internal linking) → auto-merge allowed.
  - Medium risk (new claims, trend analysis) → AI+human sampling.
  - High risk (financial recommendations, legal interpretation) → mandatory human approval.
- **Source traceability**: every factual sentence should map to a URL + timestamp.
- **Kill switch**: one flag disables all publishing actions.
- **Budget controls**: cap token/tool spend per day and per agent.

### 4) Recommended technical stack

- **Agent runtime**: LangGraph, CrewAI, or a custom queue-based orchestrator.
- **Workflow scheduler**: Temporal, Prefect, or GitHub Actions cron.
- **Memory/state**:
  - Short-term run state in Redis/Postgres.
  - Long-term content memory in a vector store for retrieval.
- **Tooling integrations**:
  - GitHub API for branch/PR automation.
  - Analytics API (GA4/Plausible).
  - Email provider API for newsletter publishing.
- **Observability**: OpenTelemetry traces + alerting to Slack/email.

### 5) Rollout plan (safe path)

- **Phase 1 – Copilot mode**: AI drafts only; humans review all.
- **Phase 2 – Supervised autonomy**: AI can publish low-risk updates automatically.
- **Phase 3 – Full autonomy with audits**: AI handles end-to-end pipeline, with random human audits and automated policy tests.

### 6) Minimum success metrics

- Content throughput (posts/week)
- Time-to-publish from source discovery
- Error rate (fact/compliance corrections)
- Organic traffic growth
- Newsletter conversion rate
- Percentage of tasks requiring human intervention

### Practical note for this static site

For this repository, the safest first implementation is to have the publisher agent only edit content sections in `news.html`, `insights.html`, and related article pages while leaving shared layout/assets untouched. Then enforce PR checks before merge.
