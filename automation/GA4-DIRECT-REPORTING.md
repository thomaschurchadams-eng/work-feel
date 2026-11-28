# Manual aggregate Direct reporting

The GA4 endpoint keeps its existing 7/28-day response unless `diagnostic: "direct"`
is supplied. The diagnostic is pinned to property **520110560**, reuses the existing
`analytics.readonly` service account and existing GitHub OIDC authorization, and
requires `commitSha` equal to the deployed revision. No new credentials, scopes,
trusted workflows, schedules, managers, internal filters or tracking settings.

The diagnostic defines Direct using `sessionDefaultChannelGroup = Direct`.
It obtains the reporting timezone from Data API report metadata before resolving
calendar dates. Defaults: seven days ending three property-calendar days ago and
the immediately preceding seven days. Both optional dates must be real inclusive
YYYY-MM-DD dates, before property today, in an interval of 1–28 days. The prior
period always has the same length and is adjacent without overlap.

Seven independent reports cover totals, daily trend, landing pages (without query
strings), hostname, country, device and new/returning. All include sessions,
active/new users, engaged sessions, engagement rate and engagement duration.
Each exact dimension/metric/filter shape is checked through `checkCompatibility`
before querying. Unsupported combinations remain explicitly unavailable, never
zero-filled. Other report errors preserve successful aggregates; property access
denial aborts. Each query has a ten-second timeout; the seven bounded report pairs
run concurrently. Limits across both periods: 2 total rows, 56 daily rows, 50 rows
per other report, no pagination. Read dateRange on rows to distinguish current
from previous. Missing dates are not proof of zero traffic.

Receipts include exact SHA, property, timezone, both date intervals, generation
time, row counts/limits and truncation, provider dataTruncationReasons, sampling,
threshold and restriction flags. Provider truncation marks a report truncated
even when every returned row fits under the limit; any truncated report makes
the overall diagnostic partial and requires attention.
Generation time is not an ingestion watermark. Recent data can still be revised.
Hostnames other than the canonical site/www are withheld as another-host bucket;
landing pages are restricted to the committed public-path allowlist. Updating that
allowlist requires a code review as pages are added. Unknown paths are withheld,
not joined together or represented as a complete ranked bucket. Hostname is event
scoped; cross-host sessions may count in more than one row. Internal visitors
cannot be identified from hostname, country or device. Existing GA4 filters may
have excluded traffic, or internal/preview traffic may still contaminate totals.
Consent, retention and reporting identity can also limit results. This diagnostic
cannot recover unrecorded historical referral sources.

## Release and execution

This draft requires parent confirmation of release authority before merge or
deployment. Existing main pushes still trigger the normal operations job; a merge
can therefore cause existing publishing/reconciliation behavior. An ordinary main merge is therefore unsuitable for a reporting-only release.
One possible path is a separately parent-approved merge commit containing
`[skip actions]`, followed by verified Vercel deployment and then the manual
metrics-only dispatch. Confirm that both CI skip behavior and deployment
propagation are honored; no release is authorized by this runbook.
The endpoint and workflow must both be on main, with the same deployed SHA, before
real reports can be retrieved. The existing production GA4 environment must remain
configured; no credentials belong in GitHub workflow inputs or artifacts. Allow
the configured 60-second GA4 function execution budget at deployment. The cold
identity-key lookup can use 5 seconds, OAuth token 10 seconds, timezone probe 10
seconds, then the slowest parallel compatibility/report pair 10 + 10 seconds:
45 seconds of sequential network budget in total, leaving 15 seconds for local
processing and serialization. The runner's 240-second request timeout and the
job's eight-minute timeout exceed that endpoint budget. Deployment must confirm
that the function's 60-second maxDuration setting is honored.

After authorized release and verified production propagation, manually dispatch
**CUAI verified operations** on main with **metrics_only = true**, optionally
supplying both dates. This excludes the operate job and runs only
`scripts/run-ga4-report-only.cjs` with contents:read and existing id-token:write.
It uses a separate cuai-ga4-reporting concurrency group so reporting dispatches
cannot replace pending production operations. It invokes identity, operations-health, then ga4-metrics; it never imports the
operations runner, reads queues, calls Buffer, writes GitHub content, schedules,
publishes or reconciles. It fails on deployment drift without retries that could
change the target revision. Aggregate receipts are retained for seven days as
`cuai-ga4-direct-<SHA>-<run ID>`. Partial and all-unavailable structured diagnostic reports are uploaded but
mark the run as requiring attention (exit code 1); sanitized per-report error
codes are preserved without provider messages or bearer identities. Do not dispatch the workflow without metrics_only=true for
this investigation. No live report was requested during implementation.

Reference reporting run: https://github.com/thomaschurchadams-eng/work-feel/actions/runs/37996020957
Google schema: https://developers.google.com/analytics/devguides/reporting/data/v1/api-schema
Compatibility: https://developers.google.com/analytics/devguides/reporting/data/v1/rest/v1beta/properties/checkCompatibility
