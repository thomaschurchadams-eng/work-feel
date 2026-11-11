# CUAI verified operations

Production analytics and Buffer endpoints require a short-lived GitHub Actions identity. A public commit SHA is only a deployment-version check. GET requests cannot schedule a post. Tokens are accepted only for this repository's immutable id, owner id, main branch and `.github/workflows/cuai-operations.yml`; pull requests, other workflows, other repositories and expired tokens fail closed.

The existing publication task keeps its editorial authority and schedule. It prepares the approved social queue and verifies the production deployment. The deployment-success workflow authenticates, reads analytics, and attempts at most one eligible queued social item under the existing validation, channel, image, fixed-time and duplicate limits. It records the Buffer receipt back to the same queue with an optimistic file-version check. All runs are serialized. No new AI calls, stored credentials or subscriptions are added.

A GitHub deployment run and a Buffer scheduling success are different outcomes. Read `CUAI verified operations` and its `cuai-operation-receipts` artifact. A successful social item has a recorded Buffer post id. Missing, failed or superseded workflow results are not publishing success. A source failure remains visible even when another operation succeeds. Do not infer revenue or customer conversion from incomplete aggregates.

A timeout after an external request is ambiguous: inspect Buffer before any retry. Existing text/post matching provides a reconciliation check, not a globally transactional idempotency guarantee. Do not submit parallel direct requests. A queued item with a past reservation needs a newly valid reservation under the approved posting rules; it is not silently rescheduled.

Recovery: correct an invalid deployment, source credential or queue issue, then rerun the existing workflow on main. Never restore the SHA-only authentication path. The health endpoint verifies the caller and deployed version without scheduling any post. No secrets appear in URLs, receipts, repository files or ordinary logs.

This change does not move the newsroom, change output targets, authorize personal LinkedIn posts, or expand publishing authority. GitHub and Vercel retain their own access controls. The Pineview dashboard observes these receipts.

References: https://docs.github.com/en/actions/reference/security/oidc

## Read-only Buffer reservation inventory

The existing authenticated `buffer-metrics` response includes a separate
`reservationInventory`. Its ordinary sent metrics remain compatible; top-level
`ok: true` proves neither inventory completeness nor permission to reserve.
The inventory queries only the approved CreditUnionAI News channel ID, verifies
its name/service, and follows opaque `after` cursors until an explicit terminal
`hasNextPage: false`. It reads all provider-retained statuses and dates, including
scheduled/sending posts, drafts, approvals, errors and retained sent history.
There is no 28-day cutoff on this inventory and no exclusion of old-created posts
scheduled far ahead. This supersedes the earlier sent-metrics-only limitation;
the separate metrics `posts` array still is not a full reservation inventory.

The read is bounded to ten pages of 100 records and ten seconds. Missing or
malformed pages, cursor cycles, duplicate IDs, wrong channels, invalid dates,
unknown statuses, GraphQL errors, rate limits, timeouts and exhausted bounds
return `complete: false` plus a stable error and any partial evidence. They never
become an empty successful inventory. Draft/approval/error/sending states,
overdue scheduled posts, unknown destinations and a paused/unknown channel queue
set `requiresReview`. Post text, non-CUAI URLs, query strings and fragments are
not included in the inventory receipt; ambiguous or shortened destinations need
the existing owner's review even when the same post also has a recognized CUAI
URL. Dropping an unresolved URL from the receipt does not clear that review
requirement. No arbitrary link expansion is performed.

Before reserving any article, media or house slot, the sole publisher must read
this field from a current authorized response, verify `complete: true`, resolve
`requiresReview`, and check its `startedAt`/`observedAt`, exact deployment commit
and channel against current main/provider state. Reconcile the returned IDs,
statuses, `dueAt`, `sentAt` and canonical URLs with the unchanged shared queue for
daily/weekly capacity and parent/destination deduplication. An absent field,
partial response, stale receipt or unresolved identity/destination is a hold.
Pagination is an observation window, not an atomic snapshot, reservation or
guarantee that another actor has not changed Buffer since the read. Re-read when
the action is no longer contemporaneous; never use an old successful artifact as
proof of a free future slot. These checks also apply to articles: the legacy
article scheduler's first-100 query alone cannot establish complete inventory.

The existing operations runner preserves this additive field in its normal
`buffer-metrics.json` receipt. It remains a combined workflow that can reconcile
state and schedule an already-queued post: do not dispatch/rerun it or invoke a
scheduler merely to obtain a read. This change adds no credentials, permissions,
authentication bypass, job, queue write, provider mutation or scheduling authority.
It does not make the native caller eligible for GitHub workflow identity. Live
verification must use an already-authorized read or a naturally occurring
trusted operations receipt after release, with its age and scope stated.

Schema references checked November 11, 2026:
[Buffer pagination](https://developers.buffer.com/guides/pagination.html),
[posts query and status schema](https://developers.buffer.com/reference.html),
[stable creation-date sorting](https://developers.buffer.com/types/PostSortableKey.html).
