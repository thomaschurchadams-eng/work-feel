'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { spawnSync } = require('node:child_process');
const { validateCurrentContinuity } = require('../lib/daily-cycle-guards.cjs');
const { inspectPublisherValidation } = require('../lib/publisher-validation.cjs');
const clone = value => structuredClone(value);
const validator = path.resolve(__dirname, '../scripts/validate-daily-cycle-preservation.mjs');
function repo(t, state) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cuai-edge-')); t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const run = (command, args, env = {}) => spawnSync(command, args, { cwd: dir, encoding: 'utf8', env: { ...process.env, ...env } });
  const git = (...args) => { const r = run('git', args); assert.equal(r.status, 0, r.stderr); return r.stdout.trim(); };
  fs.mkdirSync(path.join(dir, 'automation')); const file = 'automation/daily-cycle-state.json';
  const write = value => fs.writeFileSync(path.join(dir, file), JSON.stringify(value));
  const commit = title => { git('add', '.'); git('commit', '-qm', title); return git('rev-parse', 'HEAD'); };
  git('init', '-q'); git('config', 'user.name', 'Test'); git('config', 'user.email', 'test@example.invalid'); write(state); const baseline = commit('synthetic accepted baseline');
  return { dir, run, git, write, commit, baseline, validate: base => run(process.execPath, [validator, file, base || baseline]) };
}
function empty(date) { return { date, fullArticleCount: 0, alertCount: 0, publications: [] }; }
for (const kind of ['count mismatch', 'duplicate identities']) test(`rollover rejects ${kind} before admission and on no-op reconciliation`, () => {
  const before = empty('2026-11-06'), next = empty('2026-11-07');
  if (kind === 'count mismatch') next.fullArticleCount = 1;
  else { next.publications = [{ type: 'article', url: '/news/a.html' }, { type: 'article', url: 'https://creditunionainews.com/news/a.html' }]; next.fullArticleCount = 2; }
  assert.throws(() => validateCurrentContinuity(before, next), /same-day article identities|identities are duplicated/);
  assert.throws(() => validateCurrentContinuity(next, next), /same-day article identities|identities are duplicated/);
});
test('actual CLI rejects malformed rollover while legitimate next-day reset and repeated reconciliation pass', t => {
  const base = { version: 1, history: [], current: { ...empty('2026-11-06'), publications: [{ type: 'article', url: '/news/a.html' }], fullArticleCount: 1 } };
  const f = repo(t, base); const next = { ...base, history: [clone(base.current)], current: empty('2026-11-07') };
  for (const mutate of [c => { c.current.fullArticleCount = 1; }, c => { c.current.publications = [{ type: 'article', url: '/news/a.html' }, { type: 'article', url: 'https://creditunionainews.com/news/a.html' }]; c.current.fullArticleCount = 2; }]) {
    const bad = clone(next); mutate(bad); f.write(bad); assert.equal(f.validate().status, 1);
  }
  f.write(next); assert.equal(f.validate().status, 0); const landed = f.commit('legitimate rollover'); assert.equal(f.validate(landed).status, 0);
  const appended = clone(next); appended.current.publications.push({ type: 'article', url: '/news/new-day.html' }); appended.current.fullArticleCount = 1;
  f.write(appended); assert.equal(f.validate(landed).status, 0);
});
test('historical rollover preserves actual completed receipts and unresolved legacy checkpoints exactly', t => {
  const base = clone(require('../automation/daily-cycle-state.json'));
  base.current = clone(base.history.find(entry => entry.date === '2026-11-06'));
  base.history = base.history.filter(entry => entry.date !== '2026-11-06');
  base.current.regularPublicationSlots.push({ slot: 3, status: 'pending-validation', accountableOwner: 'daily-publisher', nextReviewAt: '2026-11-06T18:00:00Z', evidence: { pending: { head: 'a'.repeat(40), run: 101, job: 201 } } });
  const f = repo(t, base); const next = { ...base, history: [...base.history, clone(base.current)], current: empty('2026-11-07') };
  f.write(next); assert.equal(f.validate().status, 0); const landed = f.commit('preserved unresolved rollover'); assert.equal(f.validate(landed).status, 0);
  const mutated = clone(next); mutated.history.at(-1).regularPublicationSlots.at(-1).nextReviewAt = '2026-11-07T18:00:00Z'; f.write(mutated);
  const result = f.validate(landed); assert.equal(result.status, 1); assert.match(result.stderr, /mutated existing history entry/);
});
test('strict chain remains closed after complete restoration and never invokes downstream operations', t => {
  const base = { version: 1, history: [], current: { ...empty('2026-11-06'), publications: [{ type: 'article', url: '/news/a.html' }], fullArticleCount: 1 } };
  const f = repo(t, base); fs.mkdirSync(path.join(f.dir, 'scripts')); fs.mkdirSync(path.join(f.dir, 'lib'));
  for (const file of ['scripts/validate-daily-cycle-preservation.mjs', 'lib/daily-cycle-guards.cjs']) fs.copyFileSync(path.join(__dirname, '..', file), path.join(f.dir, file));
  const source = fs.readFileSync(path.join(__dirname, '../scripts/validate-daily-cycle-chain.mjs'), 'utf8');
  fs.writeFileSync(path.join(f.dir, 'scripts/validate-daily-cycle-chain.mjs'), source.replace('aa43cf2782628289bd927c480799ba15b45af4be', f.baseline));
  f.commit('install test-only anchored gate');
  f.write({ ...base, current: empty('2026-11-06') }); f.commit('invalid intermediate loss');
  f.write(base); const restored = f.commit('full data restoration');
  for (const event of ['push', 'schedule', 'workflow_dispatch']) {
    const result = f.run('bash', ['-c', 'node scripts/validate-daily-cycle-chain.mjs && touch external-operations-invoked'], { GITHUB_EVENT_NAME: event, CUAI_PUSH_BEFORE: restored });
    assert.equal(result.status, 1); assert.match(result.stderr, /dropped a same-day publication/); assert.equal(fs.existsSync(path.join(f.dir, 'external-operations-invoked')), false);
  }
});
test('same-owner helper recovery preserves attempt fencing across an in-progress rerun and exact terminal success', async () => {
  const head = 'a'.repeat(40), pending = { prNumber: 1, head, run: 101, job: 202, runAttempt: 2, accountableOwner: 'daily-publisher', nextReviewAt: '2026-11-06T16:00:00Z' };
  let active = true;
  const args = { pending, now: '2026-11-06T16:01:00Z', readPullRequest: async () => ({ head_sha: head, state: 'open', merged: false }), readWorkflowRun: async () => ({ id: 101, head_sha: head, run_attempt: 2, status: active ? 'in_progress' : 'completed', conclusion: active ? null : 'success' }), readWorkflowJobs: async () => [{ id: 202, run_id: 101, run_attempt: 2, head_sha: head, name: 'design-checks', status: active ? 'in_progress' : 'completed', conclusion: active ? null : 'success' }] };
  let result = await inspectPublisherValidation(args); assert.equal(result.decision, 'pending-validation'); assert.equal(result.canRecordTerminalOutcome, false); assert.equal(result.shouldEscalate, true);
  active = false; result = await inspectPublisherValidation(args); assert.equal(result.decision, 'awaiting-visual-review'); assert.equal(result.terminalEvidence.runAttempt, 2); assert.equal(result.releaseReady, false);
  result = await inspectPublisherValidation({ ...args, pending: { ...pending, job: 201, runAttempt: 1 } }); assert.equal(result.decision, 'stale-validation'); assert.equal(result.canRecordTerminalOutcome, false);
});

// Shapes verified from allowed current-main run 42259507773. The positive
// success case changes only the conclusion and uses a synthetic open PR.
const currentJobSample = { id: 128035422239, name: 'design-checks', status: 'completed', conclusion: 'skipped', run_id: 42259507773, run_attempt: 1, head_sha: '5b98f7eecab7455a8969067662ad8b116cb6411e' };
function connectorFixture(conclusion = 'success') {
  const job = { ...currentJobSample, conclusion }, repository = 'thomaschurchadams-eng/work-feel';
  const pending = { prNumber: 268, head: job.head_sha, run: job.run_id, job: job.id, runAttempt: 1, accountableOwner: 'daily-publisher', nextReviewAt: '2026-11-06T16:00:00Z' };
  const run = { id: job.run_id, head_sha: job.head_sha, run_attempt: job.run_attempt, status: 'completed', conclusion: 'success', repository: { full_name: repository } };
  const normalized = { id: job.id, name: job.name, status: job.status, conclusion: job.conclusion, run_id: job.run_id, logs_url: null, steps: null };
  const reads = [];
  const tools = {
    mcp__codex_apps__github_get_pr_info: async () => ({ structuredContent: { head_sha: job.head_sha, state: 'open', merged: false } }),
    mcp__codex_apps__github_fetch: async args => { reads.push(args.url); return { structuredContent: { content: JSON.stringify(args.url.includes('/jobs?') ? { total_count: 1, jobs: [job] } : run) } }; },
    mcp__codex_apps__github_fetch_workflow_run_jobs: async () => { reads.push('normalized-jobs'); return { structuredContent: { jobs: [normalized] } }; }
  };
  return { tools, repository, pending, now: '2026-11-06T16:01:00Z', job, run, normalized, reads };
}
test('actual normalized jobs shape cannot prove exact head/attempt even when status is successful', async () => {
  const f = connectorFixture();
  const result = await inspectPublisherValidation({ pending: f.pending, now: f.now, readPullRequest: async () => ({ head_sha: f.job.head_sha, state: 'open', merged: false }), readWorkflowRun: async () => f.run, readWorkflowJobs: async () => [f.normalized] });
  assert.equal(result.decision, 'observation-blocked'); assert.equal(result.reason, 'exact-job-attempt-or-head-unavailable'); assert.equal(result.canRecordTerminalOutcome, false);
});
test('raw GitHub jobs binding retains actual shape and can observe a synthetic exact success', async () => {
  const f = connectorFixture(); const { inspectUsingGitHubTools } = require('../lib/publisher-validation.cjs');
  const result = await inspectUsingGitHubTools(f);
  assert.equal(result.decision, 'awaiting-visual-review'); assert.equal(result.canRecordTerminalOutcome, true); assert.equal(result.releaseReady, false);
  assert.equal(result.terminalEvidence.head, f.job.head_sha); assert.equal(result.terminalEvidence.runAttempt, 1);
  assert.deepEqual(f.reads, [`https://api.github.com/repos/${f.repository}/actions/runs/${f.job.run_id}`, `https://api.github.com/repos/${f.repository}/actions/runs/${f.job.run_id}/jobs?filter=latest&per_page=100`]);
});
test('actual skipped raw-job sample is a technical failure, never visual or publication acceptance', async () => {
  const f = connectorFixture('skipped'); const { inspectUsingGitHubTools } = require('../lib/publisher-validation.cjs');
  const result = await inspectUsingGitHubTools(f);
  assert.equal(result.decision, 'technical-failure'); assert.equal(result.terminalEvidence.jobConclusion, 'skipped'); assert.equal(result.terminalEvidence.conclusion, 'failure'); assert.equal(result.releaseReady, false);
});
