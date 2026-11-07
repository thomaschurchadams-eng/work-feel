'use strict';

// Read-only: no publication, state writes, mutation retries or scheduling.
const sha = v => typeof v === 'string' && /^[a-f0-9]{40}$/.test(v);
const id = v => Number.isSafeInteger(v) && v > 0;
const dated = v => typeof v === 'string' && /(?:Z|[+-]\d\d:\d\d)$/.test(v) && Number.isFinite(Date.parse(v));

async function inspectPublisherValidation({ pending, readPullRequest, readWorkflowRun, readWorkflowJobs, now = new Date().toISOString() }) {
  if (!pending || !id(pending.prNumber) || !sha(pending.head) || !id(pending.run) || !id(pending.job) ||
      pending.accountableOwner !== 'daily-publisher' || !dated(pending.nextReviewAt) || !dated(now) ||
      (pending.runAttempt !== undefined && !id(pending.runAttempt))) throw Error('invalid-publisher-validation-checkpoint');
  for (const reader of [readPullRequest, readWorkflowRun, readWorkflowJobs]) if (typeof reader !== 'function') throw Error('missing-publisher-validation-reader');
  const reviewOverdue = Date.parse(now) >= Date.parse(pending.nextReviewAt);
  const base = { accountableOwner: 'daily-publisher', head: pending.head, run: pending.run, job: pending.job,
    nextReviewAt: pending.nextReviewAt, observedAt: now, reviewOverdue, releaseReady: false,
    canRecordTerminalOutcome: false, shouldEscalate: reviewOverdue };
  const blocked = reason => ({ ...base, decision: 'observation-blocked', reason, nextAction: 'Retain the same checkpoint and owner; resolve the read blocker without replaying work.' });
  const readError = error => {
    const reason = ['FORBIDDEN', 'UNAUTHORIZED', '403', '401'].includes(String(error.code)) ? 'access-denied' :
      ['RATE_LIMITED', 'TOO_MANY_REQUESTS', '429'].includes(String(error.code)) ? 'rate-limited' :
      ['NOT_FOUND', '404'].includes(String(error.code)) ? 'resource-not-found' : 'authoritative-read-unavailable';
    return blocked(reason);
  };
  let pr, run, jobs;
  try { pr = await readPullRequest(pending.prNumber); } catch (error) { return readError(error); }
  if (!pr || typeof pr !== 'object') return blocked('invalid-authoritative-response');
  const currentHead = pr.head_sha || pr.head?.sha;
  if (!sha(currentHead)) return blocked('current-pr-head-unavailable');
  if (pr.merged || pr.state === 'closed') return { ...base, shouldEscalate: false, checkpointObsolete: true, decision: 'reconcile-existing-release', reason: 'pr-already-closed', nextAction: 'Inspect the existing release outcome; do not reopen or publish this candidate again.' };
  try { [run, jobs] = await Promise.all([readWorkflowRun(pending.run), readWorkflowJobs(pending.run)]); }
  catch (error) { return readError(error); }
  if (!run || !Array.isArray(jobs) || run.id !== pending.run || !sha(run.head_sha) || !id(run.run_attempt)) return blocked('invalid-authoritative-response');
  if (currentHead !== pending.head || run.head_sha !== pending.head || (pending.runAttempt !== undefined && run.run_attempt !== pending.runAttempt))
    return { ...base, decision: 'stale-validation', reason: 'head-or-attempt-changed', nextAction: 'Reconcile the same PR and record the replacement exact-head checkpoint; old success cannot clear it.' };
  const job = jobs.find(item => item.id === pending.job);
  if (!job || job.run_id !== pending.run || job.name !== 'design-checks') return blocked('exact-design-job-unavailable');
  if (!id(job.run_attempt) || !sha(job.head_sha)) return blocked('exact-job-attempt-or-head-unavailable');
  if (job.run_attempt !== run.run_attempt || job.head_sha !== run.head_sha) return blocked('inconsistent-run-job-snapshot');
  if (pending.runAttempt === undefined) return { ...base, decision: 'checkpoint-attempt-resolution-required', canRecordTerminalOutcome: false, resolvedCheckpoint: { head: pending.head, run: pending.run, job: pending.job, runAttempt: run.run_attempt, observedAt: now }, nextAction: 'Persist this verified attempt on the same checkpoint, then re-observe before terminal closeout.' };
  const active = new Set(['queued', 'in_progress', 'waiting', 'pending', 'requested']);
  if (active.has(run.status) || active.has(job.status)) return { ...base, decision: 'pending-validation', reason: 'check-not-terminal', nextAction: 'Keep the same PR, head, run and owner. Re-read before closeout; do not write a conflicting terminal outcome.' };
  if (run.status !== 'completed' || job.status !== 'completed') return blocked('unknown-workflow-status');
  const conclusions = new Set(['success', 'failure', 'cancelled', 'timed_out', 'action_required', 'neutral', 'skipped', 'stale', 'startup_failure']);
  if (!conclusions.has(run.conclusion) || !conclusions.has(job.conclusion)) return blocked('unknown-terminal-conclusion');
  const succeeded = run.conclusion === 'success' && job.conclusion === 'success';
  return { ...base, canRecordTerminalOutcome: true, shouldEscalate: !succeeded,
    decision: succeeded ? 'awaiting-visual-review' : 'technical-failure',
    reason: succeeded ? 'exact-head-check-passed' : 'exact-head-check-did-not-pass',
    terminalEvidence: { head: pending.head, run: pending.run, job: pending.job, runAttempt: run.run_attempt,
      conclusion: succeeded ? 'success' : 'failure', runConclusion: run.conclusion, jobConclusion: job.conclusion, observedAt: now },
    nextAction: succeeded ? 'Verify the exact artifact and perform actual visual review before the existing release gates.' : 'Retain recovery ownership and escalate the exact terminal failure on the existing incident.' };
}

function payload(result) {
  if (!result || result.isError || !result.structuredContent) {
    const error = Error('github-read-unavailable');
    error.code = result?.structuredContent?.error_code;
    throw error;
  }
  return result.structuredContent;
}
async function inspectUsingGitHubTools({ tools, repository, pending, now }) {
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository || '')) throw Error('invalid-repository');
  return inspectPublisherValidation({ pending, now,
    readPullRequest: async number => payload(await tools.mcp__codex_apps__github_get_pr_info({ repository_full_name: repository, pr_number: number })),
    readWorkflowRun: async runId => {
      const response = payload(await tools.mcp__codex_apps__github_fetch({ url: `https://api.github.com/repos/${repository}/actions/runs/${runId}` }));
      const run = JSON.parse(response.content);
      if (run.repository?.full_name !== repository) throw Error('workflow-repository-mismatch');
      return run;
    },
    readWorkflowJobs: async runId => {
      // The normalized jobs connector omits head_sha and run_attempt. Read the
      // raw job records so exact head/attempt fencing remains verifiable.
      const response = payload(await tools.mcp__codex_apps__github_fetch({ url: `https://api.github.com/repos/${repository}/actions/runs/${runId}/jobs?filter=latest&per_page=100` }));
      return JSON.parse(response.content).jobs;
    }
  });
}
module.exports = { inspectPublisherValidation, inspectUsingGitHubTools };
