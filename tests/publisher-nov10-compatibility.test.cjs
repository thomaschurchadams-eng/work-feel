'use strict';
// Actual immutable historical inputs; new proposals are isolated local fixtures.
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');
const guards = require('../lib/daily-cycle-guards.cjs');
const planner = require('../lib/publisher-write-plan.cjs');
const rules = structuredClone(require('../automation/publishing-rules.json'));
// Exercise the historic fixture under the policy in force at that time.
delete rules.standardCycle.effectiveDate; delete rules.standardCycle.oneTimeException;
const root = path.resolve(__dirname, '..'), file = 'automation/daily-cycle-state.json';
const cli = path.join(root, 'scripts/validate-daily-cycle-preservation.mjs');
const refs = {
  previous: 'ad01aaf1f00959665840e82318d1477940b6b107',
  metadata: '259d6a5c50f0dd97d90c8e052af9b5bd48920326',
  alert: '2c6d7cc9c99c987c1ed5ae7ba0a2dacbda29b422',
  article: '7ab4c73a58b5c965bc559e01bab5acfe6e692ef8',
  main: 'f2260a0269b03c30029df993b17bf56647a5fa05'
};
const bytes = ref => execFileSync('git', ['show', `${ref}:${file}`], { cwd: root });
const state = ref => JSON.parse(bytes(ref)), copy = value => structuredClone(value);
const actual = state(refs.main), live = actual.current.regularPublicationSlots[0];
const command = (cwd, base, candidate) => spawnSync(process.execPath, [cli, file, base, ...(candidate ? [candidate] : [])], { cwd, encoding: 'utf8' });
function fixture(t, base) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cuai-nov10-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const git = (...args) => execFileSync('git', args, { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  git('init', '-q'); git('config', 'user.name', 'Isolated test'); git('config', 'user.email', 'test@example.invalid');
  git('config', 'commit.gpgsign', 'false'); git('config', 'core.hooksPath', path.join(dir, 'empty-hooks'));
  fs.mkdirSync(path.join(dir, 'automation')); fs.writeFileSync(path.join(dir, file), bytes(base));
  git('add', '.'); git('commit', '-qm', 'isolated historical base');
  return { dir, git, base: git('rev-parse', 'HEAD'), write: value => fs.writeFileSync(path.join(dir, file), JSON.stringify(value)) };
}
const edges = [[refs.previous, refs.alert], [refs.alert, refs.article], [refs.article, refs.main]];
for (const [base, candidate] of edges) test(`Nov10 exact historical edge ${base.slice(0, 7)} -> ${candidate.slice(0, 7)} passes; copied proposal/commit fails`, t => {
  const result = command(root, base, candidate); assert.equal(result.status, 0, result.stderr);
  const f = fixture(t, base); f.write(state(candidate));
  assert.equal(command(f.dir, f.base).status, 1);
  f.git('add', '.'); f.git('commit', '-qm', 'copied legacy result is not exempt');
  assert.equal(command(f.dir, f.base, f.git('rev-parse', 'HEAD')).status, 1);
});
test('Nov10 wrong predecessors and metadata-equivalent base do not broaden exact compatibility', () => {
  for (const [base, candidate] of [[refs.metadata, refs.alert], [refs.previous, refs.article], [refs.alert, refs.main]]) {
    assert.equal(command(root, base, candidate).status, 1, `${base} -> ${candidate}`);
  }
});
test('actual Nov10 and full Nov9 Alert/failure/hold history survive unchanged no-op', () => {
  assert.equal(actual.history.length, 80); assert.equal(actual.current.fullArticleCount, 1);
  assert.deepEqual(actual.history.at(-1), state(refs.alert).current);
  for (const old of state(refs.metadata).history) assert.deepEqual(actual.history.find(day => day.date === old.date), old);
  assert.equal(live.evidence.pending.prNumber, 313);
  assert.equal(live.evidence.pending.head, '4e973f783a5d10b2e2457837a01b2bda6a9805e0');
  assert.equal(live.evidence.pending.run, 42813406645); assert.equal(live.evidence.pending.job, 129820286964);
  assert.equal(live.evidence.pending.runAttempt, 1); assert.equal(live.productionCommit, refs.article);
  assert.equal(live.evidence.terminalAcceptance.artifactId, 13763247335);
  assert.equal(live.evidence.terminalAcceptance.artifactDigest, 'sha256:43b210cafc179c1891e3f5d19cf048e0c77b840ba294d96fb55de00c3b84a9f7');
  assert.equal(command(root, refs.main, refs.main).status, 0);
  assert.equal(planner.planStateWrite({ expectedMain: refs.main, observedMain: refs.main, base: actual, candidate: copy(actual), rules }).kind, 'already-recorded');
});
test('prospective Nov11 preparation/holds retain exact Nov10 cycle; dropped receipts reject', t => {
  const f = fixture(t, refs.main), next = copy(actual); next.history.push(copy(next.current));
  next.current = { date: '2026-11-13', status: 'in-progress', outcomeSlot: 1, fullArticleCount: 0, alertCount: 0, publications: [], regularPublicationSlots: [{ slot: 1, status: 'prepared', candidateTitle: 'Isolated next-day candidate', url: '/news/nov11-fixture.html', accountableOwner: 'daily-publisher', nextReviewAt: '2026-11-11T12:30:00Z' }] };
  f.write(next); assert.equal(command(f.dir, f.base).status, 0);
  const hold = copy(next); hold.current.regularPublicationSlots[0].status = 'editorial-hold'; hold.current.regularPublicationSlots[0].holdReason = 'Isolated source evidence insufficient';
  guards.validateStatePreservation(next, hold, rules);
  const approval = copy(hold); approval.current.regularPublicationSlots[0].status = 'approval-hold'; approval.current.regularPublicationSlots[0].holdReason = 'Isolated explicit approval missing';
  guards.validateStatePreservation(hold, approval, rules);
  const damaged = copy(next); delete damaged.history.at(-1).regularPublicationSlots[0].evidence; f.write(damaged);
  const rejected = command(f.dir, f.base); assert.equal(rejected.status, 1); assert.match(rejected.stderr, /complete prior current/);
});
test('isolated additional-slot failure/replacement retains actual live slot and all history', () => {
  const prepared = copy(actual); prepared.current.status = 'in-progress'; prepared.current.outcomeSlot = 2;
  prepared.current.regularPublicationSlots.push({ slot: 2, status: 'prepared', candidateTitle: 'Isolated additional candidate', url: '/news/nov10-isolated.html', accountableOwner: 'daily-publisher', nextReviewAt: '2026-11-10T14:30:00Z' });
  guards.validateStatePreservation(actual, prepared, rules);
  const pending = copy(prepared), slot = pending.current.regularPublicationSlots[1]; slot.status = 'pending-validation';
  slot.evidence = { pending: { prNumber: 990402, head: 'a'.repeat(40), run: 99000000402, job: 99000001402, runAttempt: 1 } };
  guards.validateStatePreservation(prepared, pending, rules);
  const failed = copy(pending); failed.current.regularPublicationSlots[1].status = 'technical-failure';
  const receipt = { ...slot.evidence.pending, conclusion: 'failure', runConclusion: 'failure', jobConclusion: 'failure', observedAt: '2026-11-10T14:25:00Z' };
  failed.current.regularPublicationSlots[1].evidence.terminalValidation = receipt;
  guards.validateStatePreservation(pending, failed, rules);
  const replacement = copy(failed), replaced = replacement.current.regularPublicationSlots[1]; replaced.status = 'pending-validation';
  replaced.evidence = { pending: { ...slot.evidence.pending, head: 'b'.repeat(40), run: 99000000403, job: 99000001403 }, validationHistory: [{ ...slot.evidence.pending, status: 'superseded', observedAt: receipt.observedAt, terminalValidation: receipt }] };
  guards.validateStatePreservation(failed, replacement, rules);
  assert.deepEqual(replacement.current.regularPublicationSlots[0], live); assert.deepEqual(replacement.history, actual.history);
  const stale = copy(replacement); stale.current.regularPublicationSlots[1].status = 'validated';
  stale.current.regularPublicationSlots[1].evidence.terminalValidation = { ...receipt, conclusion: 'success', runConclusion: 'success', jobConclusion: 'success' };
  stale.current.regularPublicationSlots[1].evidence.terminalAcceptance = { ...replaced.evidence.pending, visualReviewedAt: '2026-11-10T14:26:00Z' };
  assert.throws(() => guards.validateStatePreservation(replacement, stale, rules), /validated slot lacks exact terminal and visual evidence/);
  const unstructured = copy(actual); unstructured.current.thirdSlot = 'Validation still pending after turn closed';
  assert.throws(() => guards.validateStatePreservation(actual, unstructured, rules), /structured slot transition|slot 3/);
});
test('report retains prospective five-slot target without reopening actual one-article Tuesday', () => {
  const report = JSON.parse(execFileSync(process.execPath, ['scripts/report-publisher-slots.mjs', '2026-11-10'], { cwd: root, encoding: 'utf8' }));
  assert.equal(report.intended, 5); assert.equal(report.slots[0].status, 'live-verified');
  assert.deepEqual(report.slots.slice(1).map(s => s.status), Array(4).fill('unclassified-no-slot-evidence'));
  assert.match(report.basis, /not retrospective obligations/);
});
test('original Nov6 raw closeout remains rejected after exact historical additions', () => {
  const result = command(root, 'c3724bc99da14b9ef8d6d4fe3de3d4ab90779e37', '8f00ca6e2741a099f979e256d700f4f72a95d36b');
  assert.equal(result.status, 1); assert.match(result.stderr, /structured slot transition/);
});
