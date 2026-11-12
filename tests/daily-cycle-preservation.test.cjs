// Extends the existing draft PR268 regression with same-day/pending cases.
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { spawnSync } = require('node:child_process');
const validator = path.resolve(__dirname, '../scripts/validate-daily-cycle-preservation.mjs');
const copy = value => JSON.parse(JSON.stringify(value));
test('actual CLI rejects history loss, same-day loss and pending closeout against exact base', t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'cuai-preservation-cli-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const file = 'automation/daily-cycle-state.json'; fs.mkdirSync(path.join(directory, 'automation'));
  const base = { version: 1, timezone: 'America/New_York', history: Array.from({ length: 60 }, (_, i) => ({ date: new Date(Date.UTC(2026, 7, i + 1)).toISOString().slice(0, 10), audit: i })), current: {
    date: '2026-11-06', fullArticleCount: 1, alertCount: 0, publications: [{ type: 'article', url: '/news/first.html' }],
    regularPublicationSlots: [{ slot: 2, status: 'pending-validation', accountableOwner: 'daily-publisher', nextReviewAt: '2026-11-06T17:00:00Z', evidence: { pending: { prNumber: 1, head: 'a'.repeat(40), run: 101, job: 201, runAttempt: 1 } } }]
  } };
  const write = state => fs.writeFileSync(path.join(directory, file), JSON.stringify(state));
  const run = (exe, args) => spawnSync(exe, args, { cwd: directory, encoding: 'utf8' });
  write(base);
  for (const args of [['init', '-q'], ['add', file], ['-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '-qm', 'synthetic exact baseline']]) assert.equal(run('git', args).status, 0);
  const validate = () => run(process.execPath, [validator, file, 'HEAD']);
  assert.equal(validate().status, 0);
  const cases = [
    [c => { c.history = c.history.slice(0, 1); }, /history shrank from 60 entries to 1/],
    [c => { c.current.publications = []; c.current.fullArticleCount = 0; }, /dropped a same-day publication/],
    [c => { c.current.regularPublicationSlots[0].status = 'technical-failure'; }, /without matching terminal evidence/],
    [c => { c.current.date = '2026-11-07'; }, /without preserving prior current/],
    [c => { c.current.date = '2026-11-05'; }, /current date regressed/]
  ];
  for (const [mutate, expected] of cases) { const c = copy(base); mutate(c); write(c); const result = validate(); assert.equal(result.status, 1, result.stdout); assert.match(result.stderr, expected); }
  const advanced = copy(base); advanced.history.push(advanced.current); advanced.current = { date: '2026-11-07', fullArticleCount: 0, alertCount: 0, publications: [] }; write(advanced); assert.equal(validate().status, 0);
});
test('existing PR and main operations invoke preservation before external operations', () => {
  const workflow = fs.readFileSync(path.join(__dirname, '../.github/workflows/cuai-operations.yml'), 'utf8');
  assert.match(workflow, /Validate daily-cycle history against PR base/);
  assert.match(workflow, /BASE_SHA: \$\{\{ github.event.pull_request.base.sha \}\}/);
  assert.match(workflow, /fetch-depth: 0/);
  assert.match(workflow, /CUAI_PUSH_BEFORE: \$\{\{ github.event.before \}\}/);
  assert.match(workflow, /run: node scripts\/validate-daily-cycle-chain.mjs/);
  assert.ok(workflow.indexOf('Validate daily-cycle history from accepted baseline and pre-push main') < workflow.indexOf('Verify authorization and process bounded operations'));
});
test('actual CLI rejects two-write live bypass and loss/reopen of actual completed slots', t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'cuai-terminal-cli-')); t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  fs.mkdirSync(path.join(directory, 'automation')); const file = 'automation/daily-cycle-state.json';
  const write = s => fs.writeFileSync(path.join(directory, file), JSON.stringify(s));
  const run = (exe, args) => spawnSync(exe, args, { cwd: directory, encoding: 'utf8' });
  for (const args of [['init', '-q'], ['config', 'user.name', 'Test'], ['config', 'user.email', 'test@example.invalid']]) assert.equal(run('git', args).status, 0);
  const commit = () => { assert.equal(run('git', ['add', '.']).status, 0); assert.equal(run('git', ['commit', '-qm', 'synthetic control']).status, 0); };
  const canonical = copy(require('../automation/daily-cycle-state.json'));
  canonical.current = copy(canonical.history.find(entry => entry.date === '2026-11-06'));
  canonical.history = canonical.history.filter(entry => entry.date !== '2026-11-06');
  write(canonical); commit();
  for (const mutate of [c => { c.current.regularPublicationSlots = []; }, c => { c.current.regularPublicationSlots[1].status = 'pending-validation'; c.current.regularPublicationSlots[1].evidence.pending.runAttempt = 1; }]) {
    const c = copy(canonical); mutate(c); write(c); assert.equal(run(process.execPath, [validator, file, 'HEAD']).status, 1);
  }
  const failed = { version: 1, history: [], current: { date: '2026-11-06', fullArticleCount: 0, alertCount: 0, publications: [], regularPublicationSlots: [{ slot: 1, status: 'technical-failure', accountableOwner: 'daily-publisher', nextReviewAt: '2026-11-06T17:00:00Z', evidence: { pending: { head: 'a'.repeat(40), run: 1, job: 2, runAttempt: 1 }, terminalValidation: { head: 'a'.repeat(40), run: 1, job: 2, runAttempt: 1, conclusion: 'failure', observedAt: '2026-11-06T16:00:00Z' } } }] } };
  write(failed); commit(); const bypass = copy(failed); bypass.current.regularPublicationSlots[0] = { slot: 1, status: 'live-verified' }; write(bypass);
  assert.equal(run(process.execPath, [validator, file, 'HEAD']).status, 1);
});
