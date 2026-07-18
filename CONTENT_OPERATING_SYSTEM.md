# CreditUnionAI News Content Operating System

## Core Publishing Rule
CreditUnionAI News operates in automatic-production mode. Routine articles do not require Tom's approval.

Candidates must pass the source, confidence, originality, and quality hard stops in `automation/publishing-rules.json`. Passing stories publish directly to `main` and Vercel production. Failed candidates are logged with reasons instead of being routed for routine approval.

## Automated Editorial Workflow

1. Gather credible developments from public sources.
2. Normalize candidates using `automation/editorial-taxonomy.json`.
3. Score newsworthiness, credit-union relevance, coverage gaps, originality, source quality, and urgency.
4. Reject candidates that fail a hard stop or minimum score.
5. Select a balanced weekly portfolio across functions, technologies, formats, audiences, and maturity levels.
6. Generate the article, image, metadata, source notes, sitemap entry, and social distribution assets.
7. Run link, markup, metadata, similarity, sourcing, and conflict checks.
8. Commit successful packages directly to `main`; Vercel deploys production automatically.
9. Append the published story to `automation/coverage-ledger.json`.
10. Use the Monday analytics review to recommend adjustments to targets, weights, timing, and content mix.

Infrastructure, templates, and site-wide design changes still use a branch and pull request. The automatic-production rule applies to validated editorial packages.

## Conflict-Safe Rules
- Use public sources only.
- Do not use confidential information from Fiserv, Infinite Solutions, clients, internal conversations, or non-public work exposure.
- Do not imply affiliation with Fiserv or Infinite Solutions.
- Avoid publishing employer/client-specific analysis unless based entirely on public information and framed neutrally.
- Clearly label sponsored content.
- Preserve editorial independence from advertisers and vendors.

## Image Workflow
Images are approved as part of the full Vercel article preview, not as a separate production step.

1. Sugerman drafts the article and creates/selects the image.
2. Article + image are placed together on a preview branch.
3. Tom reviews the full Vercel preview page.
4. Tom can approve the whole package or ask for copy/image revisions.
5. Only approved article/image packages move to production placement.

## Weekly Publishing Schedule — Starter Version

### Monday — AI News Brief
Short news article based on public developments from regulators, vendors, or credit union ecosystem sources.

### Wednesday — Practical Insight / Playbook
Evergreen article for credit union leaders, boards, operations, risk, fraud, lending, or member experience teams.

### Friday — Weekly Briefing / Newsletter Draft
A concise weekly roundup:
- 3–5 important AI/credit union developments
- why they matter
- action items for leaders
- links back to site articles

## Suggested Publishing Targets
- 2 articles per week minimum
- 1 newsletter per week
- 1 sponsor/revenue asset per week until sponsorships are ready

## Status Labels
- Idea
- Researching
- Drafting
- Ready for Preview
- Preview Live
- Tom Approved Preview
- Placement Approved
- Published
- Held / Rejected

## Approval Packet Template

```text
Approval request: [Title]

Type: News / Insight / Newsletter / Sponsored / Page update
Recommended publish slot:
Proposed preview branch:
Proposed URL:

Summary:
[2–4 bullets]

Sources:
- [source 1]
- [source 2]

Image:
- concept/file
- alt text

Conflict check:
- Public sources only: Yes/No
- Any Fiserv/Infinite Solutions overlap: Yes/No + note
- Sponsored/vendor relationship: Yes/No + label needed?

Files changed:
- path/to/file.html

Next approval needed:
Preview it / Revise copy / Revise image / Hold / Reject

After Vercel preview is live, Tom can reply:
Approved — article page only / Approved — put on News / Approved — put on Home and News / Revise copy / Revise image / Hold
```

## Current Site Publishing Path
- Repo: `thomaschurchadams-eng/work-feel`
- Hosting: Vercel
- Site type: static HTML/CSS/JS
- Editorial publishing: validated article package → direct commit to `main` → Vercel Production Deployment
- Infrastructure publishing: branch → pull request → merge to `main`
