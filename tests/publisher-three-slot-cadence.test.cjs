'use strict';
// All writes are to disposable Git fixtures. Checkpoint IDs, URLs, terminal and
// live receipts below are simulated; no network readers or publishers are used.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');
const { checkCapacity, selectSlot } = require('../lib/media-slots.cjs');
const root = path.resolve(__dirname, '..');
const cli = path.join(root, 'scripts/validate-daily-cycle-preservation.mjs');
const rules = require('../automation/publishing-rules.json');
const actual = require('../automation/daily-cycle-state.json');
// Freeze the authorized pre-expansion state. Canonical current advances during
// publication, so using it here would make the next real package fail its CI.
const november12Baseline = JSON.parse(execFileSync('git', ['show', '2f4ff9ccc0960c54c83dff4eed7753a145fcc5ef:automation/daily-cycle-state.json'], { cwd: root }));
const stateFile = 'automation/daily-cycle-state.json';
const copy = value => structuredClone(value);
const url = number => `https://cadence-fixture.invalid/news/story-${number}.html`;
function nextWeekday(date) {
  const day = new Date(date + 'T12:00:00Z');
  do { day.setUTCDate(day.getUTCDate() + 1); } while ([0, 6].includes(day.getUTCDay()));
  return day.toISOString().slice(0, 10);
}
const fixtureDate = nextWeekday(actual.current.date);
const stamp = fixtureDate + 'T12:30:00Z';
const events = [];
test.after(() => {
  if (process.env.CUAI_CADENCE_EVIDENCE_PATH) fs.writeFileSync(process.env.CUAI_CADENCE_EVIDENCE_PATH, JSON.stringify({ simulationOnly: true, commandsUseActualCLI: true, events }, null, 2) + '\n');
});
const empty = (date = fixtureDate) => ({ date, status: 'in-progress', fullArticleCount: 0, alertCount: 0, publications: [], regularPublicationSlots: [] });
const fresh = date => ({ ...copy(actual), history: [...copy(actual.history), copy(actual.current)], current: empty(date) });
function fixture(t, initial = fresh()) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cuai-three-slots-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const git = (...args) => execFileSync('git', args, { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  git('init', '-q'); git('config', 'user.name', 'Isolated cadence test'); git('config', 'user.email', 'test@example.invalid');
  git('config', 'commit.gpgsign', 'false'); git('config', 'core.hooksPath', path.join(dir, 'empty-hooks'));
  fs.mkdirSync(path.join(dir, 'automation')); fs.mkdirSync(path.join(dir, 'scripts'));
  fs.copyFileSync(path.join(root, 'scripts/report-publisher-slots.mjs'), path.join(dir, 'scripts/report-publisher-slots.mjs'));
  fs.writeFileSync(path.join(dir, 'automation/publishing-rules.json'), JSON.stringify(rules));
  let value = copy(initial);
  const write = next => fs.writeFileSync(path.join(dir, stateFile), JSON.stringify(next));
  write(value); git('add', '.'); git('commit', '-qm', 'isolated initial state');
  const validate = (next, label, expected = 0, pattern) => {
    write(next);
    const head = git('rev-parse', 'HEAD'), bytes = fs.readFileSync(path.join(dir, stateFile));
    const r = spawnSync(process.execPath, [cli, stateFile, head], { cwd: dir, encoding: 'utf8' });
    events.push({ test: t.name, label, exit: r.status, stdout: r.stdout.trim(), stderr: r.stderr.trim(), articles: next.current.fullArticleCount, slots: next.current.regularPublicationSlots?.map(s => ({ slot: s.slot, status: s.status, pending: s.evidence?.pending })) });
    assert.equal(r.status, expected, `${label}: ${r.stderr}`); if (pattern) assert.match(r.stderr, pattern);
    assert.equal(git('rev-parse', 'HEAD'), head, 'validator must not write Git');
    assert.deepEqual(fs.readFileSync(path.join(dir, stateFile)), bytes, 'validator must not rewrite its input');
  };
  return {
    dir, git, get state() { return copy(value); },
    accept(next, label) { validate(next, label); git('add', stateFile); git('commit', '-qm', label); value = copy(next); },
    reject(next, pattern, label) { validate(next, label, 1, pattern); write(value); },
    repeat(label = 'duplicate no-write validation') { validate(value, label); validate(value, label); },
    report(next = value, date = next.current.date) {
      write(next);
      const articles = next.current.publications.filter(p => p.type === 'article').map((p, i) => ({ id: `fixture-${i}`, url: p.url, publishedAt: `${next.current.date}T12:00:00Z` }));
      fs.writeFileSync(path.join(dir, 'automation/coverage-ledger.json'), JSON.stringify({ articles }));
      const r = spawnSync(process.execPath, ['scripts/report-publisher-slots.mjs', date], { cwd: dir, encoding: 'utf8' });
      assert.equal(r.status, 0, r.stderr); write(value); return JSON.parse(r.stdout);
    }
  };
}
function prepared(state, number) {
  const next = copy(state); next.current.status = 'in-progress'; next.current.outcomeSlot = number;
  next.current.regularPublicationSlots.push({ slot: number, status: 'prepared', url: url(number), candidateTitle: `Isolated distinct story ${number}`, accountableOwner: 'daily-publisher', nextReviewAt: stamp });
  return next;
}
function pending(state, number, head = 'abcdef'[number - 1].repeat(40), attempt = 1) {
  const next = copy(state), s = next.current.regularPublicationSlots.find(s => s.slot === number);
  s.status = 'pending-validation'; s.evidence = { pending: { prNumber: 990100 + number, head, run: 99000000100 + number + (attempt - 1) * 10, job: 99000000200 + number + (attempt - 1) * 10, runAttempt: attempt } };
  return next;
}
function completed(state, number) {
  const next = copy(state), s = next.current.regularPublicationSlots.find(s => s.slot === number), p = s.evidence.pending;
  s.status = 'live-verified'; s.verifiedAt = stamp; s.productionCommit = p.head;
  next.current.publications.push({ type: 'article', url: url(number) }); next.current.fullArticleCount++;
  s.evidence.terminalValidation = { ...p, conclusion: 'success', observedAt: stamp };
  s.evidence.terminalAcceptance = { ...p, visualReviewedAt: stamp };
  return next;
}
function validated(state, number) {
  const next = copy(state), s = next.current.regularPublicationSlots.find(s => s.slot === number), p = s.evidence.pending;
  s.status = 'validated'; s.evidence.terminalValidation = { ...p, conclusion: 'success', observedAt: stamp };
  s.evidence.terminalAcceptance = { ...p, visualReviewedAt: stamp }; return next;
}
function fill(f, number) {
  f.accept(prepared(f.state, number), `slot ${number} prepared without CI identity`);
  assert.equal(f.state.current.regularPublicationSlots.at(-1).evidence, undefined);
  f.accept(pending(f.state, number), `slot ${number} exact checkpoint persisted`);
  f.accept(validated(f.state, number), 'persist separate validated stage');
  f.accept(completed(f.state, number), `slot ${number} simulated verified result`);
}
test('prospective rules are five each weekday, twenty-five full week, same bounded research and social cap', () => {
  assert.deepEqual(Object.values(rules.standardCycle.fullArticleTargetByWeekday), [5, 5, 5, 5, 5]);
  assert.equal(rules.standardCycle.fullArticleMaximumPerWeekday, 5);
  assert.equal(rules.weeklyTargets.siteStoriesMax, 25); assert.equal(rules.weeklyTargets.linkedinPosts, 5);
  assert.equal(rules.standardCycle.minimumCandidatesToEvaluate, 12); assert.equal(rules.standardCycle.minimumDistinctBeatsToSearch, 6);
  const before = JSON.parse(execFileSync('git', ['show', '2445fa393c5291e12a840d7f57bbc83a162ba8a8:automation/publishing-rules.json'], { cwd: root }));
  assert.deepEqual(rules.standardCycle.fallbackOrder, before.standardCycle.fallbackOrder);
  assert.deepEqual(rules.hardStops, before.hardStops);
  assert.deepEqual(rules.selection, { ...before.selection, maximumSamePrimaryFunctionPerWeek: 3 });
});
test('five sequential packages pass actual CLI; repeat is read-only and reporter shows five distinct live fixtures', t => {
  const f = fixture(t); for (let n = 1; n <= 5; n++) fill(f, n);
  f.repeat(); const report = f.report(); assert.equal(report.intended, 5);
  assert.deepEqual(report.slots.map(s => s.status), ['live-verified', 'live-verified', 'live-verified', 'live-verified', 'live-verified']);
  assert.equal(new Set(report.slots.map(s => s.liveUrl)).size, 5); assert.deepEqual(f.state.history, fresh().history);
});
test('third-slot editorial hold keeps the first two live receipts and explicit reason', t => {
  const f = fixture(t); fill(f, 1); fill(f, 2); const earlier = f.state.current.regularPublicationSlots;
  const next = f.state; next.current.status = 'complete-with-hold'; next.current.outcomeSlot = 3;
  next.current.regularPublicationSlots.push({ slot: 3, status: 'editorial-hold', accountableOwner: 'daily-publisher', holdReason: 'Twelve-candidate fixture pool has no third independently supported story.' });
  f.accept(next, 'third slot held after bounded pool'); f.repeat();
  assert.deepEqual(f.state.current.regularPublicationSlots.slice(0, 2), earlier);
  const report = f.report(); assert.equal(report.slots[2].status, 'editorial-hold'); assert.match(report.slots[2].unfilledReason, /no third/); assert.equal(report.slots[2].liveUrl, null);
});
for (const outcome of ['pending validation; publisher turn ended', 'technical failure; no article published']) test(`thirdSlot prose-only ${outcome} is rejected (frozen guard control accepts it)`, t => {
  const f = fixture(t), proposal = f.state; proposal.current.thirdSlot = outcome;
  for (const name of ['scripts/validate-daily-cycle-preservation.mjs', 'lib/daily-cycle-guards.cjs']) {
    const target = path.join(f.dir, 'frozen-guard', name); fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, execFileSync('git', ['show', `2445fa393c5291e12a840d7f57bbc83a162ba8a8:${name}`], { cwd: root }));
  }
  fs.writeFileSync(path.join(f.dir, stateFile), JSON.stringify(proposal));
  const baseline = spawnSync(process.execPath, [path.join(f.dir, 'frozen-guard/scripts/validate-daily-cycle-preservation.mjs'), stateFile, f.git('rev-parse', 'HEAD')], { cwd: f.dir, encoding: 'utf8' });
  assert.equal(baseline.status, 0, baseline.stderr);
  events.push({ test: t.name, label: 'unchanged frozen92340b47 actual CLI control', exit: baseline.status, stdout: baseline.stdout.trim(), stderr: baseline.stderr.trim() });
  f.reject(proposal, /structured slot transition/, 'new thirdSlot prose cannot bypass missing checkpoint');
  const wrongSlot = prepared(f.state, 1); wrongSlot.current.thirdSlot = outcome;
  f.reject(wrongSlot, /matching slot 3/, 'unrelated prepared slot cannot cover third-slot prose');
});
for (const number of [2, 3]) test(`slot ${number} pending/failure/replacement retains earlier receipts and rejects stale success`, t => {
  const f = fixture(t); for (let n = 1; n < number; n++) fill(f, n);
  const earlier = f.state.current.regularPublicationSlots;
  f.accept(prepared(f.state, number), 'prepare later slot'); f.accept(pending(f.state, number), 'persist pending'); f.repeat('duplicate pending observation');
  const failed = f.state, s = failed.current.regularPublicationSlots.at(-1); s.status = 'technical-failure'; s.nextAction = 'Same owner awaits existing recovery specialist result';
  s.evidence.terminalValidation = { ...s.evidence.pending, conclusion: 'failure', observedAt: stamp };
  f.accept(failed, 'matching terminal failure'); f.repeat('duplicate failure observation');
  if (number === 2) f.reject(prepared(f.state, 3), /earlier article slot/, 'slot three cannot start behind failed slot two');
  const replacement = pending(f.state, number, 'ef'[number - 2].repeat(40), 2), r = replacement.current.regularPublicationSlots.at(-1);
  r.evidence.validationHistory = [{ ...s.evidence.pending, status: 'superseded', observedAt: stamp, terminalValidation: copy(s.evidence.terminalValidation) }];
  f.accept(replacement, 'replacement keeps original failed checkpoint');
  const stale = completed(f.state, number); stale.current.regularPublicationSlots.at(-1).evidence.terminalValidation = { ...s.evidence.pending, conclusion: 'success', observedAt: stamp };
  f.reject(stale, /matching terminal evidence/, 'old checkpoint success cannot close replacement');
  const wrongAttempt = completed(f.state, number); wrongAttempt.current.regularPublicationSlots.at(-1).evidence.terminalValidation.runAttempt = 1;
  f.reject(wrongAttempt, /matching terminal evidence/, 'wrong attempt cannot close replacement');
  f.accept(validated(f.state, number), 'persist separate validated stage');
  f.accept(completed(f.state, number), 'exact replacement succeeds in isolated state');
  assert.deepEqual(f.state.current.regularPublicationSlots.slice(0, number - 1), earlier);
  assert.deepEqual(f.state.current.regularPublicationSlots.at(-1).evidence.validationHistory[0].terminalValidation, s.evidence.terminalValidation);
});
test('earlier pending slot blocks later package and a batch cannot invent the earlier live receipt', t => {
  const f = fixture(t); fill(f, 1); f.accept(prepared(f.state, 2), 'prepare slot two'); f.accept(pending(f.state, 2), 'slot two pending');
  f.reject(prepared(f.state, 3), /earlier article slot/, 'cannot advance behind pending validation');
  f.reject(prepared(completed(f.state, 2), 3), /only one sequential|earlier article slot/, 'cannot batch earlier success with next preparation');
});
test('sixth article is rejected with or without slot metadata; ordinary weekends are rejected', t => {
  const f = fixture(t); for (let n = 1; n <= 5; n++) fill(f, n);
  f.reject(prepared(f.state, 6), /weekday article maximum/, 'fourth structured article');
  const untracked = f.state; untracked.current.publications.push({ type: 'article', url: url(6) }); untracked.current.fullArticleCount++;
  f.reject(untracked, /weekday article maximum/, 'fourth article without slot cannot bypass cap');
  for (const date of ['2026-11-14', '2026-11-15']) {
    const weekend = fixture(t, fresh(date)); weekend.repeat('weekend no-op has no new cycle');
    weekend.reject(prepared(weekend.state, 1), /no ordinary article slots/, `${date} new weekend package`);
  }
  const old = [actual.current, ...actual.history].find(entry => entry.date === '2026-11-07');
  const catchup = fixture(t, { version: 1, current: copy(old), history: [] }); catchup.repeat('approved historical weekend catch-up stays unchanged');
});
test('duplicate article URL or reused review head cannot count as a different slot', t => {
  const f = fixture(t); fill(f, 1); f.accept(prepared(f.state, 2), 'prepare distinct slot two');
  f.reject(pending(f.state, 2, 'a'.repeat(40), 2), /reuse a validation head/, 'same reviewed head on different run is not another package');
  f.accept(pending(f.state, 2), 'distinct slot two head');
  const duplicate = completed(f.state, 2); duplicate.current.regularPublicationSlots[1].url = url(1);
  f.reject(duplicate, /same publication/, 'two live slots cannot count same URL');
  const report = f.report(duplicate); assert.deepEqual(report.slots.slice(0, 2).map(s => s.status), ['duplicate-live-publication', 'duplicate-live-publication']);
  assert.ok(report.slots.slice(0, 2).every(s => s.liveUrl === null));
  const twice = f.state; twice.current.publications.push(copy(twice.current.publications[0])); twice.current.fullArticleCount++;
  f.reject(twice, /publication identities are duplicated/, 'duplicate publication callback does not add a write');
});
test('duplicate URL is rejected at preparation and initial pending admission, before live proof', t => {
  const f = fixture(t); fill(f, 1);
  const duplicate = f.state; duplicate.current.outcomeSlot = 2;
  duplicate.current.regularPublicationSlots.push({ slot: 2, status: 'prepared', url: url(1), candidateTitle: 'Duplicate story in a new slot', accountableOwner: 'daily-publisher', nextReviewAt: stamp });
  f.reject(duplicate, /same publication|prior canonical publication/, 'cannot prepare an earlier article again');
  f.reject(pending(duplicate, 2), /same publication|prior canonical publication/, 'cannot skip preparation to validate earlier article again');
  const untracked = fresh(); untracked.current.publications = [{ type: 'article', url: url(1) }]; untracked.current.fullArticleCount = 1;
  const legacy = fixture(t, untracked), proposal = legacy.state;
  proposal.current.outcomeSlot = 1; proposal.current.regularPublicationSlots = [{ ...duplicate.current.regularPublicationSlots[1], slot: 1 }];
  legacy.reject(proposal, /prior canonical publication/, 'untracked canonical article is not a new package');
});
test('same-head attempt replacement remains valid within its own slot; visual evidence is still required', t => {
  const f = fixture(t); fill(f, 1); f.accept(prepared(f.state, 2), 'prepare second'); f.accept(pending(f.state, 2), 'second pending');
  const failed = f.state, old = failed.current.regularPublicationSlots[1]; old.status = 'technical-failure'; old.evidence.terminalValidation = { ...old.evidence.pending, conclusion: 'failure', observedAt: stamp };
  f.accept(failed, 'failed first attempt');
  const retry = pending(f.state, 2, old.evidence.pending.head, 2); retry.current.regularPublicationSlots[1].evidence.validationHistory = [{ ...old.evidence.pending, status: 'superseded', observedAt: stamp, terminalValidation: copy(old.evidence.terminalValidation) }];
  f.accept(retry, 'same-head own-slot attempt two');
  const noVisual = completed(f.state, 2); delete noVisual.current.regularPublicationSlots[1].evidence.terminalAcceptance;
  f.reject(noVisual, /visual\/production evidence/, 'terminal success alone cannot clear live verification');
  f.accept(validated(f.state, 2), 'persist exact rerun acceptance');
  f.accept(completed(f.state, 2), 'same slot exact attempt with simulated separate visual receipt');
});
test('pre-CI preparation needs no invented IDs and retains planned URL into its pending checkpoint', t => {
  const f = fixture(t); f.accept(prepared(f.state, 1), 'honest prepared article');
  assert.equal(f.report().slots[0].status, 'prepared'); assert.equal(f.report().slots[0].liveUrl, null);
  const lost = pending(f.state, 1); delete lost.current.regularPublicationSlots[0].url;
  f.reject(lost, /publication lacks stable type\/url|lost its planned URL/, 'pending cannot lose prepared URL');
  const premature = completed(pending(f.state, 1), 1);
  f.reject(premature, /previously persisted validated checkpoint/, 'success cannot skip persisted pending stage');
  f.accept(pending(f.state, 1), 'real identity can follow preparation');
});
test('current-main rollover preserves complete actual history and stale concurrent proposal is rejected', t => {
  const f = fixture(t, actual); const next = fresh();
  f.accept(prepared(next, 1), 'prospective next weekday preparation preserves complete actual current day');
  f.accept(pending(f.state, 1), 'first next-day pending'); f.accept(validated(f.state, 1), 'persist next-day acceptance'); f.accept(completed(f.state, 1), 'first next-day live');
  const stale = prepared(f.state, 2); fill(f, 2);
  f.reject(stale, /completed publication cannot be reopened|lost or changed|dropped a same-day publication/, 'stale proposal cannot overwrite concurrent completed slot');
  const rollover = f.state; rollover.history.push(copy(rollover.current)); rollover.current = empty(nextWeekday(rollover.current.date));
  f.accept(prepared(rollover, 1), 'subsequent day retains complete prior two-slot state');
  const bad = f.state; bad.history.find(day => day.date === '2026-11-09').regularPublicationSlots[0].evidence.validationHistory = [];
  f.reject(bad, /mutated existing history/, 'cannot erase actual failed moving-date receipt');
});
test('report uses dynamic five-slot weekday targets and zero weekend targets without retroactive obligation', t => {
  const f = fixture(t); let total = 0;
  for (const date of ['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20']) { const report = f.report(f.state, date); assert.equal(report.intended, 5); total += report.intended; }
  assert.equal(total, 25); for (const date of ['2026-11-21', '2026-11-22']) assert.equal(f.report(f.state, date).intended, 0);
  assert.match(f.report(actual, '2026-11-09').basis, /not retrospective obligations/);
});
test('report classifies prepared/approval/pre-validation stages and never gives a held slot a later publication', t => {
  const f = fixture(t), state = fresh();
  state.current.publications = [{ type: 'article', url: url(3) }]; state.current.fullArticleCount = 1;
  state.current.regularPublicationSlots = [{ slot: 1, status: 'approval-hold', holdReason: 'Existing approval has not changed.' }, { slot: 2, status: 'pre-validation-blocked', blocker: { reason: 'Browser preflight unavailable.' } }, { slot: 3, status: 'prepared', url: url(3), candidateTitle: 'Isolated third story' }];
  const report = f.report(state); assert.deepEqual(report.slots.slice(0, 3).map(s => s.status), ['approval-hold', 'pre-validation-blocked', 'prepared']);
  assert.equal(report.slots[0].recordedPublicationUrl, null); assert.equal(report.slots[1].recordedPublicationUrl, null);
  assert.equal(report.slots[0].unfilledReason, 'Existing approval has not changed.'); assert.equal(report.slots[1].unfilledReason, 'Browser preflight unavailable.');
  assert.ok(report.slots.every(s => s.liveUrl === null));
});
test('three eligible articles still share one social reservation and five weekly posts through actual capacity code', () => {
  const articles = [1, 2, 3].map(n => ({ id: `fixture-${n}`, eligible: true, classification: ['Standard', 'High', 'Library'][n - 1], canonicalUrl: `https://creditunionainews.com/news/cadence-fixture-${n}.html` }));
  const input = { date: '2026-11-10', queue: [], articles, editorialOrder: articles.map(a => ({ canonicalUrl: a.canonicalUrl, rationale: `Isolated usefulness comparison for ${a.id}` })), now: Date.parse('2026-11-10T12:00:00Z') };
  assert.equal(selectSlot({ ...input, editorialOrder: undefined }).status, 'needs-editorial-selection');
  assert.deepEqual(selectSlot(input), selectSlot(input)); assert.equal(selectSlot(input).assetId, 'fixture-1');
  const queue = [{ id: 'fixture-reservation', platform: 'linkedin', status: 'queued', scheduledFor: '2026-11-10T11:30:00-05:00', articleUrl: articles[0].canonicalUrl }];
  assert.equal(selectSlot({ ...input, queue }).status, 'reserved');
  assert.equal(checkCapacity('2026-11-10', queue).error, 'linkedin_daily_cap_conflict');
  const provider = [1, 2, 3, 4, 5].map(n => ({ id: `external-fixture-${n}`, status: 'sent', sentAt: '2026-11-09T17:30:00Z' }));
  assert.equal(checkCapacity('2026-11-10', [], provider).error, 'linkedin_weekly_cap_conflict');
  assert.equal(checkCapacity('2026-11-14', []).error, 'scheduled_for_weekend');
});

test('November 12 frozen baseline admits five additional sequential packages and rejects a seventh', t => {
  const f = fixture(t, november12Baseline); const baseline = copy(november12Baseline.current.regularPublicationSlots[0]);
  for (let n = 2; n <= 5; n++) fill(f, n);
  f.accept(prepared(f.state, 6), 'exception slot six prepared');
  const reviewState = f.state;
  for (let n = 2; n <= 5; n++) { reviewState.current.regularPublicationSlots[n - 1].url = `/news/story-${n}.html`; reviewState.current.publications[n - 1].url = `/news/story-${n}.html`; }
  reviewState.current.regularPublicationSlots[5].url = '/news/exception-six.html';
  const planner = require('../lib/publisher-write-plan.cjs'), sha = 'a'.repeat(40), blob = 'b'.repeat(40);
  const review = planner.validateArticleReview({ mergeBase: {sha, stateBlob: blob}, review: {sha, stateBlob: blob, files: [{path: 'news/exception-six.html', status: 'added'}]}, main: {sha, stateBlob: blob, state: reviewState, changedPaths: []}, rules });
  assert.equal(review.slot, 6);
  f.accept(pending(f.state, 6), 'exception exact checkpoint'); f.accept(validated(f.state, 6), 'exception validated'); f.accept(completed(f.state, 6), 'exception live');
  assert.equal(f.state.current.fullArticleCount, 6); assert.deepEqual(f.state.current.regularPublicationSlots[0], baseline);
  assert.equal(f.report().intended, 6); f.reject(prepared(f.state, 7), /weekday article maximum/, 'seventh article exceeds exception');
  const changed = f.state; changed.current.regularPublicationSlots[0].evidence.pending.head = 'f'.repeat(40);
  f.reject(changed, /lost or changed|frozen verified baseline/, 'frozen receipt cannot be rewritten');
  const damaged = copy(november12Baseline); damaged.current.regularPublicationSlots[0].productionCommit = 'a'.repeat(40);
  const bad = fixture(t, damaged); bad.reject(prepared(bad.state, 2), /frozen verified baseline/, 'unmatched baseline cannot claim exception');
});
test('Alert cap admits three distinct qualified records and rejects a fourth, weekends and historical backfill', t => {
  const f = fixture(t, november12Baseline);
  for (let n = 1; n <= 3; n++) { const next = f.state; next.current.publications.push({type:'alert', url:`/alerts.html#fixture-${n}`}); next.current.alertCount++; f.accept(next, `alert ${n}`); }
  const fourth = f.state; fourth.current.publications.push({type:'alert',url:'/alerts.html#fixture-4'}); fourth.current.alertCount++;
  f.reject(fourth, /Alert maximum/, 'fourth Alert');
  const dup = f.state; dup.current.publications.push(copy(dup.current.publications.at(-1))); dup.current.alertCount++; f.reject(dup, /duplicated/, 'duplicate Alert');
  const ordinary = fixture(t, fresh('2026-11-13'));
  for (let n = 1; n <= 3; n++) { const next = ordinary.state; next.current.publications.push({type:'alert', url:`/alerts.html#ordinary-${n}`}); next.current.alertCount++; ordinary.accept(next, `ordinary alert ${n}`); }
  const over = ordinary.state; over.current.publications.push({type:'alert',url:'/alerts.html#ordinary-four'}); over.current.alertCount++; ordinary.reject(over, /Alert maximum/, 'ordinary fourth Alert');
  const mismatched = ordinary.state; mismatched.current.alertCount = 2; ordinary.reject(mismatched, /alertCount regressed/, 'Alert count cannot be erased');
  const weekend = fixture(t, fresh('2026-11-14')); const w = weekend.state; w.current.publications.push({type:'alert',url:'/alerts.html#weekend'}); w.current.alertCount++; weekend.reject(w, /weekend Alert/, 'weekend Alert');
  const old = fixture(t, fresh('2026-11-11')); const o = old.state; o.current.publications.push({type:'alert',url:'/alerts.html#old'}); o.current.alertCount++; old.reject(o, /retrospective/, 'historical Alert');
});
