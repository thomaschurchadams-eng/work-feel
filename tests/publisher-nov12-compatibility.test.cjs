'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');
const guards = require('../lib/daily-cycle-guards.cjs');
const root = path.resolve(__dirname, '..'), statePath = 'automation/daily-cycle-state.json';
const cli = path.join(root, 'scripts/validate-daily-cycle-preservation.mjs');
const refs = ['470f8f191dc825cd3dec7d70b87ba3a634268649', '040e54901be0677622f009668aafc21ae5317ed6', 'd28746bb3ebae4b6a2c89c2491467e36a1a865fc', 'dd65b2c1785d126f52c0e4089fdd3f1e875621af', '7893f89b4718863d2360821962ae1f484f704f24', '33a53184da1908e6edd393ec4180de250ff51cc5', 'a8c9a78e617a80e994182cbcabe47689f7ac2ca5'];
const main = '3ce5c00aa433db78a5cfa239cf1f44cca69c7506';
const read = ref => JSON.parse(execFileSync('git', ['show', `${ref}:${statePath}`], { cwd: root, encoding: 'utf8' }));
const current = read(main), copy = value => structuredClone(value);
const run = (cwd, base, candidate) => spawnSync(process.execPath, [cli, statePath, base, ...(candidate ? [candidate] : [])], { cwd, encoding: 'utf8' });
for (let i = 1; i < refs.length; i++) test(`Nov11/12 exact historical edge ${refs[i - 1].slice(0, 7)} -> ${refs[i].slice(0, 7)} is bounded`, t => {
  const base = refs[i - 1], candidate = refs[i]; const accepted = run(root, base, candidate); assert.equal(accepted.status, 0, accepted.stderr);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cuai-nov12-edge-')); t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const git = (...args) => execFileSync('git', args, { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  git('init', '-q'); git('config', 'user.name', 'Isolated compatibility'); git('config', 'user.email', 'test@example.invalid'); git('config', 'commit.gpgsign', 'false'); git('config', 'core.hooksPath', path.join(dir, 'no-hooks'));
  fs.mkdirSync(path.join(dir, 'automation')); fs.writeFileSync(path.join(dir, statePath), JSON.stringify(read(base))); git('add', '.'); git('commit', '-qm', 'isolated predecessor'); const copiedBase = git('rev-parse', 'HEAD');
  fs.writeFileSync(path.join(dir, statePath), JSON.stringify(read(candidate))); assert.equal(run(dir, copiedBase).status, 1);
  git('add', '.'); git('commit', '-qm', 'copied historical output'); assert.equal(run(dir, copiedBase, git('rev-parse', 'HEAD')).status, 1);
  const wrongBase = i === 1 ? 'f2260a0269b03c30029df993b17bf56647a5fa05' : refs[i - 2]; assert.equal(run(root, wrongBase, candidate).status, 1);
});
test('Nov12 main retains all 82 histories and five actual weekly publications without replay', () => {
  assert.equal(current.history.length, 82);
  const days = [current.current, ...current.history];
  assert.equal(days.filter(d => ['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12'].includes(d.date)).reduce((n, d) => n + d.fullArticleCount, 0), 5);
  assert.deepEqual(days.find(d => d.date === '2026-11-10'), read(refs[0]).current);
  assert.deepEqual(days.find(d => d.date === '2026-11-11'), read(refs[4]).current);
  const expected = [[315, '8aa15789c3515cabd8aa8c0a79d6a24ee0e9270e', 43018180201, 130514419009], [316, '6142537bc44f55c2862db183dc717cdf33b544e1', 43019055021, 130517346422], [322, '76a6ed45aeeb7592f86f107c7fd65ba4a9a98907', 43214677786, 131170776415]];
  for (const [pr, head, runId, job] of expected) {
    const slot = days.flatMap(d => d.regularPublicationSlots || []).find(s => s.evidence?.pending?.prNumber === pr);
    assert.equal(slot.status, 'live-verified'); assert.equal(slot.evidence.pending.head, head); assert.equal(slot.evidence.pending.run, runId); assert.equal(slot.evidence.pending.job, job); assert.equal(slot.evidence.pending.runAttempt, 1);
    assert.equal(slot.evidence.terminalValidation.conclusion, 'success'); assert.ok(slot.evidence.terminalAcceptance.visualReviewedAt); assert.ok(slot.productionCommit);
  }
  assert.equal(run(root, main, main).status, 0);
});
test('new future preparation retains whole current record and rejects altered archived receipts', () => {
  const next = copy(current); next.history.push(copy(next.current));
  next.current = { date: '2026-11-13', status: 'in-progress', outcomeSlot: 1, fullArticleCount: 0, alertCount: 0, publications: [], regularPublicationSlots: [{ slot: 1, status: 'prepared', candidateTitle: 'Isolated future candidate', url: '/news/nov12-next-fixture.html', accountableOwner: 'daily-publisher', nextReviewAt: '2026-11-13T12:30:00Z' }] };
  guards.validateStatePreservation(current, next, require('../automation/publishing-rules.json'));
  const lost = copy(next); delete lost.history.at(-1).regularPublicationSlots[0].evidence;
  assert.throws(() => guards.validateStatePreservation(current, lost, require('../automation/publishing-rules.json')), /complete prior current/);
});
test('original unstructured closeout is still rejected and source-only predecessors gain no exception', () => {
  const original = run(root, 'c3724bc99da14b9ef8d6d4fe3de3d4ab90779e37', '8f00ca6e2741a099f979e256d700f4f72a95d36b');
  assert.equal(original.status, 1); assert.match(original.stderr, /structured slot transition/);
  assert.equal(run(root, 'da5945e6f8c37f07c8618ff9b252a9414e4197ef', refs[5]).status, 1);
});
