'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { validateCurrentContinuity, validatePendingSlots } = require('../lib/daily-cycle-guards.cjs');
const copy = x => JSON.parse(JSON.stringify(x));
const pending = { head: 'a'.repeat(40), run: 101, job: 201, runAttempt: 1 };
const first = { type: 'article', url: 'https://creditunionainews.com/news/first.html', title: 'First' };
function state() { return { date: '2026-11-06', fullArticleCount: 1, alertCount: 0, publications: [copy(first)], regularPublicationSlots: [{ slot: 2, status: 'pending-validation', accountableOwner: 'daily-publisher', nextReviewAt: '2026-11-06T16:10:00Z', evidence: { pending: copy(pending) } }] }; }
test('unchanged pending state and compatible same-day append pass', () => {
  const b = state(), c = copy(b); validateCurrentContinuity(b, c);
  c.publications.push({ type: 'article', url: '/news/second.html' }); c.fullArticleCount = 2; validateCurrentContinuity(b, c);
  c.publications[0].title = 'Corrected headline'; validateCurrentContinuity(b, c);
});
for (const [name, change, pattern] of [
  ['publication deletion', c => { c.publications = []; c.fullArticleCount = 0; }, /dropped a same-day/],
  ['count regression', c => { c.fullArticleCount = 0; }, /regressed/],
  ['duplicated publication', c => { c.publications.push(copy(first)); c.fullArticleCount = 2; }, /duplicated/],
  ['dropped pending slot', c => { c.regularPublicationSlots = []; }, /dropped an unresolved/],
  ['ownerless pending', c => { c.regularPublicationSlots[0].accountableOwner = 'none'; }, /ownership/],
  ['missing review time', c => { delete c.regularPublicationSlots[0].nextReviewAt; }, /review time/],
  ['missing exact job', c => { delete c.regularPublicationSlots[0].evidence.pending.job; }, /exact head/],
  ['premature failure closeout', c => { c.regularPublicationSlots[0].status = 'technical-failure'; }, /matching terminal/],
  ['stale terminal closeout', c => { c.regularPublicationSlots[0].status = 'technical-failure'; c.regularPublicationSlots[0].evidence.terminalValidation = { ...pending, head: 'b'.repeat(40), conclusion: 'failure', observedAt: '2026-11-06T16:00:00Z' }; }, /matching terminal/]
]) test(name + ' fails closed', () => { const b = state(), c = copy(b); change(c); assert.throws(() => validateCurrentContinuity(b, c), pattern); });
test('terminal failure records result and keeps accountable recovery', () => {
  const b = state(), c = copy(b), slot = c.regularPublicationSlots[0]; slot.status = 'technical-failure'; slot.evidence.terminalValidation = { ...pending, conclusion: 'failure', observedAt: '2026-11-06T16:00:00Z' }; validateCurrentContinuity(b, c);
});
test('rebase must retain the superseded checkpoint', () => {
  const b = state(), c = copy(b), slot = c.regularPublicationSlots[0]; slot.evidence.pending = { head: 'b'.repeat(40), run: 102, job: 202, runAttempt: 1 };
  assert.throws(() => validateCurrentContinuity(b, c), /discarded the previous/);
  slot.evidence.validationHistory = [{ ...pending, status: 'superseded', observedAt: '2026-11-06T16:00:00Z' }]; validateCurrentContinuity(b, c);
});
test('live transition needs matching terminal, visual, production and publication evidence', () => {
  const b = state(), c = copy(b), slot = c.regularPublicationSlots[0]; slot.status = 'live-verified'; slot.url = '/news/second.html'; slot.verifiedAt = '2026-11-06T16:05:00Z'; slot.productionCommit = 'b'.repeat(40);
  slot.evidence.terminalValidation = { ...pending, conclusion: 'success', observedAt: '2026-11-06T16:00:00Z' };
  assert.throws(() => validateCurrentContinuity(b, c), /visual\/production/);
  slot.evidence.terminalAcceptance = { ...pending, visualReviewedAt: '2026-11-06T16:03:00Z' };
  assert.throws(() => validateCurrentContinuity(b, c), /no matching publication/);
  c.publications.push({ type: 'article', url: slot.url }); c.fullArticleCount = 2; validateCurrentContinuity(b, c);
});
test('duplicate slot numbers fail and current canonical state remains readable', () => {
  const c = state(); c.regularPublicationSlots.push(copy(c.regularPublicationSlots[0])); assert.throws(() => validatePendingSlots(c), /duplicate/);
  const canonical = require('../automation/daily-cycle-state.json'); validateCurrentContinuity(canonical.current, canonical.current);
});
test('failure intermediate cannot erase checkpoint, owner or bypass live evidence', () => {
  const b = state(), failed = copy(b), s = failed.regularPublicationSlots[0];
  s.status = 'technical-failure'; s.evidence.terminalValidation = { ...pending, conclusion: 'failure', observedAt: '2026-11-06T16:00:00Z' };
  validateCurrentContinuity(b, failed);
  for (const mutate of [
    slot => { slot.status = 'live-verified'; delete slot.evidence; delete slot.accountableOwner; delete slot.nextReviewAt; },
    slot => { slot.status = 'live-verified'; },
    slot => { slot.status = 'pending-validation'; },
    slot => { slot.evidence.terminalValidation.conclusion = 'success'; }
  ]) { const c = copy(failed); mutate(c.regularPublicationSlots[0]); assert.throws(() => validateCurrentContinuity(failed, c)); }
});
test('actual completed slots cannot disappear, reopen, or lose receipts and ownership', () => {
  const b = copy(require('../automation/daily-cycle-state.json').history.find(entry => entry.date === '2026-11-06'));
  for (const mutate of [
    c => { delete c.regularPublicationSlots; },
    c => { c.regularPublicationSlots.pop(); },
    c => { c.regularPublicationSlots[1].status = 'pending-validation'; c.regularPublicationSlots[1].evidence.pending.runAttempt = 1; },
    c => { delete c.regularPublicationSlots[1].evidence; },
    c => { delete c.regularPublicationSlots[1].accountableOwner; },
    c => { c.regularPublicationSlots[1].evidence.terminalAcceptance.head = 'c'.repeat(40); }
  ]) { const c = copy(b); mutate(c); assert.throws(() => validateCurrentContinuity(b, c)); }
  const c = copy(b); c.regularPublicationSlots[1].nextAction = 'Reconciled; no replay'; c.regularPublicationSlots[1].nextReviewAt = '2026-11-07T17:00:00Z'; validateCurrentContinuity(b, c);
});
test('actual completed catch-up slots remain intact in same-date transitions after rollover', () => {
  const ledger = require('../automation/daily-cycle-state.json');
  const b = copy([ledger.current, ...ledger.history].find(entry => entry.date === '2026-11-07'));
  assert.equal(b?.catchupSlots?.length, 2, 'both completed November 7 catch-up receipts must exist');
  assert.ok(b.catchupSlots.every(slot => slot.status === 'live-verified'));
  for (const mutate of [
    c => { delete c.catchupSlots; },
    c => { c.catchupSlots.pop(); },
    c => { c.catchupSlots[1].status = 'pending-validation'; },
    c => { delete c.catchupSlots[1].productionCommit; },
    c => { c.catchupSlots[1].url = '/news/other.html'; }
  ]) { const c = copy(b); mutate(c); assert.throws(() => validateCurrentContinuity(b, c), /completed catch-up/); }
});
test('attempt replacement and terminal closeout match exact attempt', () => {
  const b = state();
  for (const mutate of [
    s => { s.evidence.pending.runAttempt = 99; },
    s => { delete s.evidence.pending.runAttempt; },
    s => { s.status = 'technical-failure'; s.evidence.terminalValidation = { ...pending, runAttempt: 99, conclusion: 'failure', observedAt: '2026-11-06T16:00:00Z' }; }
  ]) { const c = copy(b); mutate(c.regularPublicationSlots[0]); assert.throws(() => validateCurrentContinuity(b, c)); }
});
test('legacy pending attempt requires explicit resolution checkpoint before closeout', () => {
  const b = state(); delete b.regularPublicationSlots[0].evidence.pending.runAttempt;
  const c = state(); assert.throws(() => validateCurrentContinuity(b, c), /legacy attempt/);
  c.regularPublicationSlots[0].evidence.attemptResolution = { ...pending, observedAt: '2026-11-06T16:00:00Z' }; validateCurrentContinuity(b, c);
});
test('failure -> new attempt -> exact successful visual closeout preserves prior failure receipt', () => {
  const b = state(), failed = copy(b), f = failed.regularPublicationSlots[0];
  f.status = 'technical-failure'; f.evidence.terminalValidation = { ...pending, conclusion: 'failure', observedAt: '2026-11-06T16:00:00Z' }; validateCurrentContinuity(b, failed);
  const retry = copy(failed), r = retry.regularPublicationSlots[0]; r.status = 'pending-validation'; r.evidence.pending = { ...pending, job: 202, runAttempt: 2 };
  r.evidence.validationHistory = [{ ...pending, status: 'superseded', observedAt: '2026-11-06T16:01:00Z', terminalValidation: copy(f.evidence.terminalValidation) }]; delete r.evidence.terminalValidation; validateCurrentContinuity(failed, retry);
  const done = copy(retry), d = done.regularPublicationSlots[0]; d.status = 'live-verified'; d.url = '/news/second.html'; d.productionCommit = 'b'.repeat(40); d.verifiedAt = '2026-11-06T16:05:00Z';
  d.evidence.terminalValidation = { ...r.evidence.pending, conclusion: 'success', observedAt: '2026-11-06T16:03:00Z' }; d.evidence.terminalAcceptance = { ...r.evidence.pending, visualReviewedAt: '2026-11-06T16:04:00Z' };
  done.publications.push({ type: 'article', url: d.url }); done.fullArticleCount = 2;
  validateCurrentContinuity(retry, done); validateCurrentContinuity(done, copy(done));
});
test('a date rollover cannot introduce an unevidenced live slot', () => {
  const b = state(), c = { ...copy(b), date: '2026-11-07' }; c.regularPublicationSlots[0] = { slot: 1, status: 'live-verified' };
  assert.throws(() => validateCurrentContinuity(b, c));
});
test('required current schema is checked for both sides before date continuity', () => {
  for (const mutate of [s => { delete s.date; }, s => { s.date = '2026-02-30'; }, s => { s.date = 'not-a-date'; }, s => { delete s.publications; }, s => { delete s.fullArticleCount; }, s => { s.alertCount = -1; }]) {
    const b = state(), c = copy(b); mutate(c); assert.throws(() => validateCurrentContinuity(b, c)); assert.throws(() => validateCurrentContinuity(c, b));
  }
});
