'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { inspectPublisherValidation, inspectUsingGitHubTools } = require('../lib/publisher-validation.cjs');
const head = 'a'.repeat(40), other = 'b'.repeat(40);
const pending = { prNumber: 299, head, run: 101, job: 201, runAttempt: 1, accountableOwner: 'daily-publisher', nextReviewAt: '2026-11-06T16:10:00Z' };
function input(overrides = {}) {
  return { pending, now: '2026-11-06T16:00:00Z',
    readPullRequest: async () => ({ head_sha: head, state: 'open', merged: false }),
    readWorkflowRun: async () => ({ id: 101, head_sha: head, run_attempt: 1, status: 'completed', conclusion: 'success' }),
    readWorkflowJobs: async () => [{ id: 201, run_id: 101, run_attempt: 1, head_sha: head, name: 'design-checks', status: 'completed', conclusion: 'success' }], ...overrides };
}
test('exact terminal success still requires actual visual and production review', async () => {
  const r = await inspectPublisherValidation(input());
  assert.equal(r.decision, 'awaiting-visual-review'); assert.equal(r.releaseReady, false);
  assert.equal(r.canRecordTerminalOutcome, true); assert.equal(r.terminalEvidence.head, head); assert.equal(r.accountableOwner, 'daily-publisher');
});
for (const status of ['queued', 'in_progress', 'waiting']) test(`${status} cannot be called failed or closed`, async () => {
  const r = await inspectPublisherValidation(input({ readWorkflowRun: async () => ({ id: 101, head_sha: head, run_attempt: 1, status, conclusion: null }) }));
  assert.equal(r.decision, 'pending-validation'); assert.equal(r.canRecordTerminalOutcome, false); assert.equal(r.accountableOwner, 'daily-publisher');
});
test('late success is interpreted only after terminal observation', async () => {
  let terminal = false;
  const i = input({ readWorkflowRun: async () => ({ id: 101, head_sha: head, run_attempt: 1, status: terminal ? 'completed' : 'in_progress', conclusion: terminal ? 'success' : null }) });
  assert.equal((await inspectPublisherValidation(i)).decision, 'pending-validation');
  terminal = true; assert.equal((await inspectPublisherValidation(i)).decision, 'awaiting-visual-review');
});
for (const conclusion of ['failure', 'cancelled', 'timed_out', 'skipped']) test(`terminal ${conclusion} retains recovery ownership`, async () => {
  const r = await inspectPublisherValidation(input({ readWorkflowJobs: async () => [{ id: 201, run_id: 101, run_attempt: 1, head_sha: head, name: 'design-checks', status: 'completed', conclusion }] }));
  assert.equal(r.decision, 'technical-failure'); assert.equal(r.shouldEscalate, true); assert.equal(r.releaseReady, false); assert.equal(r.accountableOwner, 'daily-publisher');
});
test('success from stale head or different attempt is not clearance', async () => {
  for (const overrides of [
    { readPullRequest: async () => ({ head_sha: other, state: 'open' }) },
    { readWorkflowRun: async () => ({ id: 101, head_sha: other, run_attempt: 1 }) },
    { readWorkflowRun: async () => ({ id: 101, head_sha: head, run_attempt: 2 }) }
  ]) { const r = await inspectPublisherValidation(input(overrides)); assert.equal(r.decision, 'stale-validation'); assert.equal(r.canRecordTerminalOutcome, false); }
});
test('overdue pending review requests escalation without inventing a failure or schedule', async () => {
  const r = await inspectPublisherValidation(input({ now: '2026-11-06T16:11:00Z', readWorkflowRun: async () => ({ id: 101, head_sha: head, run_attempt: 1, status: 'in_progress' }) }));
  assert.equal(r.decision, 'pending-validation'); assert.equal(r.reviewOverdue, true); assert.equal(r.shouldEscalate, true); assert.equal(r.nextReviewAt, pending.nextReviewAt);
});
for (const [code, reason] of [['FORBIDDEN', 'access-denied'], ['RATE_LIMITED', 'rate-limited'], ['NOT_FOUND', 'resource-not-found'], ['unknown', 'authoritative-read-unavailable']]) test(`${code} is blocked, not silently retried`, async () => {
  let calls = 0;
  const r = await inspectPublisherValidation(input({ readPullRequest: async () => { calls++; throw Object.assign(Error('private error detail'), { code }); } }));
  assert.equal(r.decision, 'observation-blocked'); assert.equal(r.reason, reason); assert.equal(calls, 1); assert.equal(r.canRecordTerminalOutcome, false); assert.ok(!JSON.stringify(r).includes('private error detail'));
});
test('wrong or missing job and malformed result fail closed', async () => {
  for (const overrides of [{ readWorkflowJobs: async () => [] }, { readWorkflowJobs: async () => [{ id: 201, run_id: 999, name: 'design-checks' }] }, { readWorkflowRun: async () => null }])
    assert.equal((await inspectPublisherValidation(input(overrides))).decision, 'observation-blocked');
});
test('already merged PR directs reconciliation, never republishing', async () => {
  const r = await inspectPublisherValidation(input({ readPullRequest: async () => ({ head_sha: head, state: 'closed', merged: true }) }));
  assert.equal(r.decision, 'reconcile-existing-release'); assert.equal(r.releaseReady, false);
});
test('an overdue superseded checkpoint cannot reopen an already completed PR', async () => {
  const r = await inspectPublisherValidation(input({ now: '2026-11-06T17:00:00Z', readPullRequest: async () => ({ head_sha: other, state: 'closed', merged: true }) }));
  assert.equal(r.decision, 'reconcile-existing-release'); assert.equal(r.shouldEscalate, false); assert.equal(r.checkpointObsolete, true);
});
test('invalid checkpoint cannot drop ownership or timezone', async () => {
  for (const change of [{ accountableOwner: 'none' }, { nextReviewAt: '2026-11-06 16:10' }, { job: null }]) await assert.rejects(inspectPublisherValidation(input({ pending: { ...pending, ...change } })), /invalid-publisher-validation-checkpoint/);
});
test('connector binding reads PR metadata and raw run/jobs without losing identity fields', async () => {
  const calls = [], repository = 'owner/repo';
  const tools = {
    mcp__codex_apps__github_get_pr_info: async a => { calls.push(a); return { structuredContent: { head_sha: head, state: 'open' } }; },
    mcp__codex_apps__github_fetch: async a => { calls.push(a); return { structuredContent: { content: JSON.stringify(a.url.endsWith('/jobs?filter=latest&per_page=100') ? { jobs: await input().readWorkflowJobs() } : { id: 101, head_sha: head, run_attempt: 1, status: 'completed', conclusion: 'success', repository: { full_name: repository } }) } }; },
    mcp__codex_apps__github_fetch_workflow_run_jobs: async () => { throw Error('lossy normalized jobs connector must not be used'); }
  };
  const r = await inspectUsingGitHubTools({ tools, repository, pending, now: input().now });
  assert.equal(r.decision, 'awaiting-visual-review'); assert.equal(calls.length, 3); assert.equal(calls[1].url, 'https://api.github.com/repos/owner/repo/actions/runs/101');
  assert.equal(calls[2].url, 'https://api.github.com/repos/owner/repo/actions/runs/101/jobs?filter=latest&per_page=100');
});
test('completed PR reconciliation makes no historical reads even if old runs are denied, missing or malformed', async () => {
  for (const mode of ['FORBIDDEN', 'NOT_FOUND', 'malformed']) {
    let oldReads = 0;
    const old = async () => { oldReads++; if (mode === 'malformed') return null; throw Object.assign(Error('old'), { code: mode }); };
    const r = await inspectPublisherValidation(input({ now: '2026-11-06T17:00:00Z', readPullRequest: async () => ({ head_sha: other, state: 'closed', merged: true }), readWorkflowRun: old, readWorkflowJobs: old }));
    assert.equal(r.decision, 'reconcile-existing-release'); assert.equal(r.shouldEscalate, false); assert.equal(oldReads, 0);
  }
});
test('job attempt and job head must match the run snapshot; missing fields fail closed', async () => {
  for (const changes of [{ run_attempt: 2 }, { run_attempt: undefined }, { head_sha: other }, { head_sha: undefined }]) {
    const job = (await input().readWorkflowJobs())[0]; Object.assign(job, changes);
    const r = await inspectPublisherValidation(input({ readWorkflowJobs: async () => [job] }));
    assert.equal(r.decision, 'observation-blocked'); assert.equal(r.canRecordTerminalOutcome, false);
  }
});
test('legacy checkpoint resolves verified attempt but cannot clear terminal work until persisted', async () => {
  const legacy = { ...pending }; delete legacy.runAttempt;
  const r = await inspectPublisherValidation(input({ pending: legacy }));
  assert.equal(r.decision, 'checkpoint-attempt-resolution-required'); assert.equal(r.canRecordTerminalOutcome, false); assert.equal(r.resolvedCheckpoint.runAttempt, 1);
});
