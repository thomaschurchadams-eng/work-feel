'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { spawnSync } = require('node:child_process');
function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cuai-chain-')); t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const exec = (cmd, args, env = {}) => spawnSync(cmd, args, { cwd: dir, encoding: 'utf8', env: { ...process.env, ...env } });
  const git = (...args) => { const r = exec('git', args); assert.equal(r.status, 0, r.stderr); return r.stdout.trim(); };
  git('init', '-q'); git('config', 'user.name', 'Test'); git('config', 'user.email', 'test@example.invalid');
  fs.mkdirSync(path.join(dir, 'automation')); fs.mkdirSync(path.join(dir, 'scripts')); fs.mkdirSync(path.join(dir, 'lib'));
  const state = { version: 1, history: [], current: { date: '2026-11-06', fullArticleCount: 1, alertCount: 0, publications: [{ type: 'article', url: '/news/one.html' }] } };
  // Explicit isolated prior live proof; count alone cannot authorize slot two.
  const pending = { prNumber: 990001, head: 'a'.repeat(40), run: 990101, job: 990201, runAttempt: 1 };
  state.current.regularPublicationSlots = [{ slot: 1, status: 'live-verified', url: '/news/one.html', accountableOwner: 'daily-publisher', nextReviewAt: '2026-11-06T12:30:00Z', verifiedAt: '2026-11-06T12:20:00Z', productionCommit: pending.head, evidence: { pending, terminalValidation: { ...pending, conclusion: 'success', observedAt: '2026-11-06T12:18:00Z' }, terminalAcceptance: { ...pending, visualReviewedAt: '2026-11-06T12:19:00Z' } } }];
  const write = s => fs.writeFileSync(path.join(dir, 'automation/daily-cycle-state.json'), JSON.stringify(s));
  const commit = title => { git('add', '.'); git('commit', '-qm', title); return git('rev-parse', 'HEAD'); };
  write(state); const baseline = commit('accepted test baseline');
  for (const file of ['scripts/validate-daily-cycle-preservation.mjs', 'lib/daily-cycle-guards.cjs', 'automation/publishing-rules.json']) fs.copyFileSync(path.join(__dirname, '..', file), path.join(dir, file));
  const source = fs.readFileSync(path.join(__dirname, '../scripts/validate-daily-cycle-chain.mjs'), 'utf8');
  assert.equal((source.match(/aa43cf2782628289bd927c480799ba15b45af4be/g) || []).length, 1);
  // Only the isolated test copy substitutes the synthetic accepted commit.
  fs.writeFileSync(path.join(dir, 'scripts/validate-daily-cycle-chain.mjs'), source.replace('aa43cf2782628289bd927c480799ba15b45af4be', baseline));
  commit('install unchanged gate with synthetic test anchor');
  const check = (event, before) => exec(process.execPath, ['scripts/validate-daily-cycle-chain.mjs'], { GITHUB_EVENT_NAME: event, CUAI_PUSH_BEFORE: before || '' });
  return { dir, state, write, commit, baseline, check, git, exec };
}
test('main chain rejects deletion in a multi-commit push and every later event without external operations', t => {
  const f = fixture(t), before = f.git('rev-parse', 'HEAD');
  f.write({ ...f.state, current: { ...f.state.current, publications: [], fullArticleCount: 0 } }); f.commit('lost publication');
  fs.writeFileSync(path.join(f.dir, 'unrelated.txt'), 'unrelated'); const last = f.commit('unrelated follow-up');
  for (const [event, boundary] of [['push', before], ['push', last], ['schedule'], ['workflow_dispatch']]) {
    const r = f.check(event, boundary); assert.equal(r.status, 1, r.stdout); assert.match(r.stderr, /dropped a same-day publication/);
  }
  const r = f.exec('bash', ['-c', 'node scripts/validate-daily-cycle-chain.mjs && touch external-operations-invoked'], { GITHUB_EVENT_NAME: 'push', CUAI_PUSH_BEFORE: before });
  assert.equal(r.status, 1); assert.equal(fs.existsSync(path.join(f.dir, 'external-operations-invoked')), false);
});
test('main chain accepts legitimate single commit, merge commit and unchanged manual/scheduled checks', t => {
  const f = fixture(t), before = f.git('rev-parse', 'HEAD');
  f.state.current.status = 'in-progress'; f.state.current.outcomeSlot = 2;
  f.state.current.regularPublicationSlots.push({ slot: 2, status: 'prepared', candidateTitle: 'Isolated second article', url: '/news/two.html', accountableOwner: 'daily-publisher', nextReviewAt: '2026-11-06T12:30:00Z' });
  f.write(f.state); f.commit('valid same-day owned preparation without publication');
  assert.equal(f.check('push', before).status, 0);
  const main = f.git('branch', '--show-current'); f.git('checkout', '-qb', 'feature'); fs.writeFileSync(path.join(f.dir, 'feature.txt'), 'metadata'); f.commit('feature'); f.git('checkout', main); const preMerge = f.git('rev-parse', 'HEAD'); f.git('merge', '--no-ff', '-m', 'merge reviewed feature', 'feature');
  for (const [event, boundary] of [['push', preMerge], ['schedule'], ['workflow_dispatch']]) { const r = f.check(event, boundary); assert.equal(r.status, 0, r.stderr); }
});
test('missing, zero, inaccessible or non-ancestor baseline fails closed', t => {
  const f = fixture(t);
  for (const before of ['', '0'.repeat(40), 'f'.repeat(40)]) { const r = f.check('push', before); assert.equal(r.status, 1); assert.match(r.stderr, /pre-push main boundary/); }
  const file = path.join(f.dir, 'scripts/validate-daily-cycle-chain.mjs'); fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace(f.baseline, 'f'.repeat(40)));
  for (const event of ['schedule', 'workflow_dispatch']) { const r = f.check(event); assert.equal(r.status, 1); assert.match(r.stderr, /baseline is unavailable/); }
});
for (const badDate of [undefined, '2026-02-30', '2026-13-01', '2026-11-6']) test(`malformed intermediate date ${badDate} cannot launder lost publications`, t => {
  const f = fixture(t);
  const damaged = JSON.parse(JSON.stringify(f.state)); damaged.current.date = badDate; damaged.current.publications = []; damaged.current.fullArticleCount = 0;
  f.write(damaged); f.commit('malformed intermediate loss'); damaged.current.date = f.state.current.date; f.write(damaged); const afterLoss = f.commit('restore shape while keeping loss');
  fs.writeFileSync(path.join(f.dir, 'later.txt'), 'unrelated'); f.commit('unrelated later work');
  for (const [event, before] of [['push', afterLoss], ['schedule'], ['workflow_dispatch']]) {
    const r = f.check(event, before); assert.equal(r.status, 1, r.stdout); assert.match(r.stderr, /current date must be a valid calendar date/);
  }
});
