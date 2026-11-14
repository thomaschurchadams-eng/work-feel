# CUAI verified operations

Production analytics and Buffer endpoints require a short-lived GitHub Actions identity. A public commit SHA is only a deployment-version check. GET requests cannot schedule a post. Tokens are accepted only for this repository's immutable id, owner id, main branch and `.github/workflows/cuai-operations.yml`; pull requests, other workflows, other repositories and expired tokens fail closed.

The existing publication task keeps its editorial authority and schedule. It prepares the approved social queue and verifies the production deployment. The deployment-success workflow authenticates, reads analytics, and attempts at most one eligible queued social item under the existing validation, channel, image, fixed-time and duplicate limits. It records the Buffer receipt back to the same queue with an optimistic file-version check. All runs are serialized. No new AI calls, stored credentials or subscriptions are added.

A GitHub deployment run and a Buffer scheduling success are different outcomes. Read `CUAI verified operations` and its `cuai-operation-receipts` artifact. A successful social item has a recorded Buffer post id. Missing, failed or superseded workflow results are not publishing success. A source failure remains visible even when another operation succeeds. Do not infer revenue or customer conversion from incomplete aggregates.

A timeout after an external request is ambiguous: inspect Buffer before any retry. Existing text/post matching provides a reconciliation check, not a globally transactional idempotency guarantee. Do not submit parallel direct requests. A queued item with a past reservation needs a newly valid reservation under the approved posting rules; it is not silently rescheduled.

Recovery: establish which layer failed before proposing a correction. A platform `deployment_authentication_required` response is not proof that Buffer rejected its credential: the application separately returns `unauthorized` for workflow identity and `buffer_authentication_failed` for a Buffer 401. Read an existing successful artifact first and bind its timestamps, deployment and channel. `buffer-metrics` queries sent posts only (up to 100 within 28 days); it does not expose a complete future reservation inventory. The combined workflow can schedule and reconcile writes, so never rerun it or call a scheduler merely to obtain a read. Correct a verified deployment, source credential or queue issue only within existing authority; any subsequent operation run requires its normal action gates. Never restore the SHA-only authentication path. The health endpoint verifies the caller and deployed version without scheduling any post. No secrets appear in URLs, receipts, repository files or ordinary logs.

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

Destination evidence includes body text and the documented LinkedIn metadata
fields `firstComment` and `linkAttachment { url expandedUrl }`. A valid CUAI
`expandedUrl` can resolve only its paired attachment URL. It never clears a
separate unresolved body/comment link, even an identical shortened string.
Different recognized destinations in the same attachment pair remain under
review; retain both canonical candidates rather than choosing one. Null metadata
is a valid absence. Missing, malformed or unexpected metadata remains a review
requirement, while pagination completeness still describes record enumeration.
`externalLink` is the social-post permalink, not an article destination, and is
not queried for this purpose. Only validated CUAI canonical paths leave memory;
comments, attachment data, foreign URLs and queries/fragments are not retained.
This normalization does not verify a destination is live or authorize a post.
Provider fields may be absent on historical posts: fixture results do not prove
recovery of the 78 destinations reported missing in the November 11 receipt.
Inspect the next authorized live receipt before claiming that outcome.

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

Destination schema independently checked November 12, 2026:
[LinkedIn post metadata](https://developers.buffer.com/types/LinkedInPostMetadata.html),
[paired attachment fields](https://developers.buffer.com/types/LinkAttachment.html),
and [Post metadata union / externalLink meaning](https://developers.buffer.com/reference.html).

## Candidate-specific historical exclusion and recovery

The November 14 recovery prepares one exact NY Fed Q3 2026 results event at its existing published URL. `distribution.reviewedEventExclusions` binds the canonical URL, parent/event IDs, reader HTML SHA-256, exact copy plus tracked URL, short review expiry, original 78-ID set digest and latest verified sent timestamp. The positive primary-source review is a dated editorial inference: November 4 advisory and November 10 release establish this edition; a conflicting November 3 calendar entry is disclosed and conservatively accommodated. This is not a general new-URL, old-age, foreign-host or title exemption. American Heritage remains held.

`buffer-history-exclusion.cjs` can exclude only that exact all-SENT set for this candidate. The proof is mandatory independently of the reader's `requiresReview` flag: a clean inventory does not waive expiry, live article bytes, snapshot or active-record constraints. Reservation ID, canonical URL, event ID or parent ID each retain the proof requirement; renaming a reservation or syndicating the story cannot evade it. It never changes reader decisions, `requiresReview` or historical flags. Missing/new IDs, any active provider record (even recognized), a later/different latest send, stale/incomplete inventory, paused/unknown channel, deployed-commit mismatch, candidate/body/copy change or a known canonical/parent/event duplicate stops recovery. A fresh complete read and live HTML hash are required immediately before mutation. Both schedulers use the same guard. The first-page duplicate receipt aid cannot authorize a new mutation. No source/diagnostic URL or private post text is added to artifacts.

The sole publisher must independently accept the exact code, proof and copy, qualify the Standard candidate, inspect its live canonical/hero and obtain fresh inventory before adding its ONE immutable reservation through the existing queue workflow. Use the catalog candidate ID, event ID, parent ID and exact copy lead plus normal UTM URL. Retain the current one-post-per-weekday and five-per-week ceilings: Monday/Friday 12:30 and Tuesday–Thursday 11:30 America/New_York, with at least five minutes remaining after pagination. Weekend slots are not authorized by this recovery patch. No queue item or provider request is created by this preparation. A ceiling is not a quota.

For this reservation, the trusted executor requires the original main push at attempt 1 and a verified before-tree without its ID, canonical, event or parent. A schedule run, workflow rerun, unrelated later push or unverifiable/malformed prior queue cannot submit it. This fence preserves one attempted submission even if a provider timeout and a failed receipt write leave the queue apparently queued. A lost opportunity or uncertain result requires the publisher to reconcile the existing attempt; it must not reset the ID or automatically renew the proof. The existing serialized workflow and current-main rechecks remain; a paginated observation is not an atomic provider lock.

Ambiguous outcomes for all formats now persist a blocked reconciliation state when the queue write succeeds; no invented post/sent ID is recorded. Preserve the run artifact and stop if the queue write fails. The first-recovery fence independently prevents its automatic retry. Do not infer equivalent provider idempotency for unrelated legacy reservations. Existing image/video/quality/tracking/authentication gates stay in force; media production stays paused. Release, scheduling and actual sent verification are separate. Recovery is established only by the publisher's actual same-channel provider sent receipt joined to this immutable reservation and canonical destination.
