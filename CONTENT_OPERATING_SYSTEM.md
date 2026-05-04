# CreditUnionAI News Content Operating System

## Core Approval Rule
Tom approves content before it becomes part of the live editorial experience.

Default approach: use a Vercel preview first, then Tom decides where it should appear.

## Preview-First Publishing Workflow

### 1. Draft locally
Sugerman drafts the article, image, metadata, and source notes locally.

### 2. Create one full preview package
Sugerman prepares the article, image, metadata, and page layout together as a single reviewable package.

The preview package includes:
- headline
- article body
- hero/card image
- alt text
- SEO/social metadata
- source links or source notes
- conflict/safety notes
- proposed URL

Tom should be able to approve or revise the article and image together from one Vercel preview link.

Tom can reply:
- `Preview it`
- `Revise copy: ...`
- `Revise image: ...`
- `Hold`
- `Reject`

### 3. Push to a preview branch, not main
Sugerman creates a branch like:
- `preview/ai-acceptable-use-policy`
- `preview/vendor-due-diligence-checklist`

This triggers a Vercel Preview Deployment without changing the production site.

### 4. Tom reviews the Vercel preview link
Sugerman sends the Vercel preview URL in chat.

Tom reviews it on phone/desktop and replies:
- `Approve preview`
- `Revise: ...`
- `Reject`

### 5. Placement decision
After Tom approves the preview, Sugerman asks or recommends placement:
- Publish article page only
- Add to News page
- Feature on Home page
- Add to Insights page
- Add to newsletter draft
- Add to sitemap
- Create LinkedIn post draft

Tom can say:
- `Put it on News`
- `Put it on Home and News`
- `Article page only for now`
- `Hold for newsletter`

### 6. Production publish
Only after Tom approves preview + placement, Sugerman merges/pushes the final approved changes to `main`.

Vercel production deploys from `main`.

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
- Preview publishing: push branch → Vercel Preview Deployment
- Production publishing: merge/push to `main` → Vercel Production Deployment
