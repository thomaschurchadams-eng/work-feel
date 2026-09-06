# CUAI verified operations

Production analytics and Buffer endpoints require a short-lived GitHub Actions identity. A public commit SHA is only a deployment-version check. GET requests cannot schedule a post. Tokens are accepted only for this repository's immutable id, owner id, main branch and `.github/workflows/cuai-operations.yml`; pull requests, other workflows, other repositories and expired tokens fail closed.

The existing publication task keeps its editorial authority and schedule. It prepares the approved social queue and verifies the production deployment. The deployment-success workflow authenticates, reads analytics, and attempts at most one eligible queued social item under the existing validation, channel, image, fixed-time and duplicate limits. It records the Buffer receipt back to the same queue with an optimistic file-version check. All runs are serialized. No new AI calls, stored credentials or subscriptions are added.

A GitHub deployment run and a Buffer scheduling success are different outcomes. Read `CUAI verified operations` and its `cuai-operation-receipts` artifact. A successful social item has a recorded Buffer post id. Missing, failed or superseded workflow results are not publishing success. A source failure remains visible even when another operation succeeds. Do not infer revenue or customer conversion from incomplete aggregates.

A timeout after an external request is ambiguous: inspect Buffer before any retry. Existing text/post matching provides a reconciliation check, not a globally transactional idempotency guarantee. Do not submit parallel direct requests. A queued item with a past reservation needs a newly valid reservation under the approved posting rules; it is not silently rescheduled.

Recovery: correct an invalid deployment, source credential or queue issue, then rerun the existing workflow on main. Never restore the SHA-only authentication path. The health endpoint verifies the caller and deployed version without scheduling any post. No secrets appear in URLs, receipts, repository files or ordinary logs.

This change does not move the newsroom, change output targets, authorize personal LinkedIn posts, or expand publishing authority. GitHub and Vercel retain their own access controls. The Pineview dashboard observes these receipts.

References: https://docs.github.com/en/actions/reference/security/oidc
