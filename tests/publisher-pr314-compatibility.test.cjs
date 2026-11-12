'use strict';
// Exact PR314 inputs; proposals and delayed observations remain isolated fixtures.
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');
const guards = require('../lib/daily-cycle-guards.cjs'), planner = require('../lib/publisher-write-plan.cjs');
const rules = require('../automation/publishing-rules.json');
const root = path.resolve(__dirname, '..'), file = 'automation/daily-cycle-state.json';
const cli = path.join(root, 'scripts/validate-daily-cycle-preservation.mjs');
const before = 'f2260a0269b03c30029df993b17bf56647a5fa05', main = '470f8f191dc825cd3dec7d70b87ba3a634268649';
const read = (ref, name = file) => JSON.parse(execFileSync('git', ['show', `${ref}:${name}`], { cwd: root, encoding: 'utf8' }));
const base = read(before), actual = read(main), copy = value => structuredClone(value);
const check = (cwd, a, b) => spawnSync(process.execPath, [cli, file, a, ...(b ? [b] : [])], { cwd, encoding: 'utf8' });
function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cuai-pr314-')); t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const git = (...args) => execFileSync('git', args, { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  git('init', '-q'); git('config', 'user.name', 'Isolated test'); git('config', 'user.email', 'test@example.invalid');
  git('config', 'commit.gpgsign', 'false'); git('config', 'core.hooksPath', path.join(dir, 'no-hooks'));
  fs.mkdirSync(path.join(dir, 'automation')); const write = value => fs.writeFileSync(path.join(dir, file), JSON.stringify(value));
  write(base); git('add', '.'); git('commit', '-qm', 'isolated predecessor'); return { dir, git, write, base: git('rev-parse', 'HEAD') };
}
test('PR314 preserves complete live receipts, 80 histories and the operating outcome', () => {
  assert.equal(actual.history.length, 80); assert.deepEqual(actual.history, base.history);
  for (const key of ['regularPublicationSlots', 'publications', 'candidateEvaluations', 'validation', 'socialDistribution', 'fullArticleCount', 'alertCount']) assert.deepEqual(actual.current[key], base.current[key]);
  assert.equal(actual.current.status, 'article-and-alert-cycle-complete');
  assert.equal(actual.current.alertCycle.status, 'no-qualified-alert'); assert.equal(actual.current.alertCycle.sourcesChecked.length, 8);
  assert.equal(actual.current.regularPublicationSlots[0].evidence.pending.prNumber, 313);
  assert.equal(actual.current.regularPublicationSlots[0].productionCommit, '7ab4c73a58b5c965bc559e01bab5acfe6e692ef8');
  const result = check(root, before, main); assert.equal(result.status, 0, result.stderr);
});
test('PR314 exception rejects copied proposal, copied commit and wrong predecessor', t => {
  const f = fixture(t); f.write(actual); assert.equal(check(f.dir, f.base).status, 1);
  f.git('add', '.'); f.git('commit', '-qm', 'copy is not historical identity'); assert.equal(check(f.dir, f.base, f.git('rev-parse', 'HEAD')).status, 1);
  assert.equal(check(root, '7ab4c73a58b5c965bc559e01bab5acfe6e692ef8', main).status, 1);
});
test('current operating state is idempotent and future Alert fields cannot hide an article blocker', () => {
  const plan = planner.planStateWrite({ expectedMain: main, observedMain: main, base: actual, candidate: copy(actual), rules });
  assert.equal(plan.kind, 'already-recorded'); assert.equal(plan.writesPerformed, 0);
  const safe = copy(actual); safe.current.alertCycle = { ...safe.current.alertCycle, reviewedAt: '2026-11-10T16:00:00-05:00', evidence: 'Isolated follow-up observation only' };
  guards.validateStatePreservation(actual, safe, rules);
  const bad = copy(safe); bad.current.blockedReason = 'Validation pending; turn closed without checkpoint';
  assert.throws(() => guards.validateStatePreservation(actual, bad, rules), /structured slot transition/);
});
test('future preparation retains full PR314 outcome; altered operating receipt rejects', () => {
  const next = copy(actual); next.history.push(copy(next.current)); next.current = { date: '2026-11-11', status: 'in-progress', outcomeSlot: 1, fullArticleCount: 0, alertCount: 0, publications: [], regularPublicationSlots: [{ slot: 1, status: 'prepared', candidateTitle: 'Isolated future candidate', url: '/news/pr314-next-fixture.html', accountableOwner: 'daily-publisher', nextReviewAt: '2026-11-11T12:30:00Z' }] };
  guards.validateStatePreservation(actual, next, rules);
  const damaged = copy(next); damaged.history.at(-1).alertCycle.evidence = 'Changed historical evidence';
  assert.throws(() => guards.validateStatePreservation(actual, damaged, rules), /complete prior current/);
});
test('historical audience and cadence wording is preserved without changing the three-slot target', () => {
  const usageBefore = read(before, 'automation/cuai-usage-ledger.json'), usage = read(main, 'automation/cuai-usage-ledger.json');
  assert.equal(usage.entries.length, usageBefore.entries.length + 1); assert.deepEqual(usage.entries.slice(0, -1), usageBefore.entries);
  assert.equal(usage.entries.at(-1).workUnits.weeklyArticlesTarget, 8);
  assert.equal(usage.entries.at(-1).operationalLearning.decision, 'inconclusive-observe');
  assert.equal(rules.weeklyTargets.siteStoriesMax, 15); assert.equal(rules.standardCycle.fullArticleMaximumPerWeekday, 3);
  for (const day of ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']) assert.equal(rules.standardCycle.fullArticleTargetByWeekday[day], 3);
  const report = JSON.parse(execFileSync(process.execPath, ['scripts/report-publisher-slots.mjs', '2026-11-10'], { cwd: root, encoding: 'utf8' }));
  assert.equal(report.intended, 3); assert.equal(report.slots[0].status, 'live-verified'); assert.match(report.basis, /not retrospective obligations/);
});
test('the original unstructured November 6 failure still rejects', () => {
  const result = check(root, 'c3724bc99da14b9ef8d6d4fe3de3d4ab90779e37', '8f00ca6e2741a099f979e256d700f4f72a95d36b');
  assert.equal(result.status, 1); assert.match(result.stderr, /structured slot transition/);
});
