'use strict';
const { isDeepStrictEqual } = require('node:util');
const dated = v => typeof v === 'string' && /(?:Z|[+-]\d\d:\d\d)$/.test(v) && Number.isFinite(Date.parse(v));
const sha = v => typeof v === 'string' && /^[a-f0-9]{40}$/.test(v);
const id = v => Number.isSafeInteger(v) && v > 0;
const fail = reason => { throw Error(reason); };
const sameJob = (a, b) => a?.head === b?.head && a?.run === b?.run && a?.job === b?.job;
const matches = (a, b) => sameJob(a, b) && id(a?.runAttempt) && a.runAttempt === b?.runAttempt;
const pendingOf = slot => slot?.evidence?.pending;
const waiting = slot => ['pending-validation', 'late-validation'].includes(slot?.status);
const owned = slot => {
  if (slot.accountableOwner !== 'daily-publisher' || !dated(slot.nextReviewAt)) fail('unresolved slot lost daily-publisher ownership or review time');
};
const checkpoint = (p, allowLegacyAttempt = false) => sha(p?.head) && id(p?.run) && id(p?.job) && (id(p?.runAttempt) || (allowLegacyAttempt && p?.runAttempt === undefined));
// Receipt objects are append-only. Metadata outside receipts can be updated.
function preserves(old, next) {
  if (old === undefined) return true;
  if (Array.isArray(old)) return Array.isArray(next) && old.every(item => next.some(value => isDeepStrictEqual(item, value)));
  if (old && typeof old === 'object') return next && typeof next === 'object' && Object.keys(old).every(key => preserves(old[key], next[key]));
  return isDeepStrictEqual(old, next);
}
function validatePendingSlots(record, { allowLegacyAttempt = false } = {}) {
  const slots = record?.regularPublicationSlots || [];
  if (!Array.isArray(slots)) fail('regular publication slots must be an array');
  const numbers = new Set();
  for (const slot of slots) {
    if (!id(slot.slot) || numbers.has(slot.slot)) fail('invalid or duplicate regular publication slot');
    numbers.add(slot.slot);
    if (waiting(slot)) {
      owned(slot);
      if (!checkpoint(pendingOf(slot), allowLegacyAttempt)) fail('pending validation lacks exact head/run/job/attempt');
    }
    if (slot.status === 'technical-failure') owned(slot);
  }
}
function publicationKey(publication) {
  if (!publication || typeof publication.type !== 'string' || typeof publication.url !== 'string') fail('publication lacks stable type/url');
  let url;
  try { url = new URL(publication.url, 'https://creditunionainews.com').href; } catch { fail('invalid publication URL'); }
  return `${publication.type}:${url}`;
}
function validateLive(slot, record) {
  owned(slot);
  const p = pendingOf(slot), observed = slot.evidence?.terminalValidation, accepted = slot.evidence?.terminalAcceptance;
  if (!checkpoint(p) || !matches(observed, p) || !dated(observed?.observedAt) || observed.conclusion !== 'success') fail('live closeout lacks matching terminal evidence');
  if (!matches(accepted, p) || !dated(accepted?.visualReviewedAt) || !dated(slot.verifiedAt) || !sha(slot.productionCommit)) fail('live closeout lacks exact-head visual/production evidence');
  if (!(record.publications || []).some(item => item.type === 'article' && publicationKey(item) === publicationKey({ type: 'article', url: slot.url }))) fail('live closeout has no matching publication');
}
function validateSlotTransition(oldSlot, nextSlot, candidate) {
  if (!nextSlot) fail('candidate dropped an unresolved or completed validation slot');
  if (oldSlot.status === 'live-verified') {
    if (nextSlot.status !== 'live-verified') fail('completed publication cannot be reopened; use a separate linked incident');
    for (const key of ['url', 'productionCommit', 'verifiedAt', 'accountableOwner', 'issueEvent', 'evidence'])
      if (!preserves(oldSlot[key], nextSlot[key])) fail(`completed publication lost or changed its ${key} receipt`);
    return;
  }
  const oldPending = pendingOf(oldSlot), newPending = pendingOf(nextSlot);
  if (!preserves(oldSlot.evidence?.validationHistory || [], nextSlot.evidence?.validationHistory || [])) fail('candidate discarded validation history');
  if (oldPending) {
    owned(nextSlot);
    // A legacy attempt is resolved from both authoritative run/job observations,
    // persisted first, and cannot close in the same transition.
    if (oldPending.runAttempt === undefined) {
      const resolution = nextSlot.evidence?.attemptResolution;
      if (!waiting(nextSlot) || !sameJob(newPending, oldPending) || !matches(resolution, newPending) || !dated(resolution?.observedAt)) fail('legacy attempt must be resolved and persisted before closeout');
      return;
    }
    if (!matches(newPending, oldPending)) {
      const archived = (nextSlot.evidence?.validationHistory || []).find(item => matches(item, oldPending) && item.status === 'superseded' && dated(item.observedAt));
      if (!waiting(nextSlot) || !archived || (oldSlot.evidence?.terminalValidation && !preserves(oldSlot.evidence.terminalValidation, archived.terminalValidation))) fail('replacement validation discarded the previous checkpoint or terminal evidence');
      return;
    }
    if (oldSlot.evidence?.terminalValidation && !preserves(oldSlot.evidence.terminalValidation, nextSlot.evidence?.terminalValidation)) fail('candidate changed or removed observed terminal evidence');
    if (waiting(nextSlot)) {
      if (!waiting(oldSlot)) fail('terminal checkpoint cannot be reopened without a new exact checkpoint');
      return;
    }
    const observed = nextSlot.evidence?.terminalValidation;
    if (!matches(observed, oldPending) || !dated(observed?.observedAt) || !['success', 'failure'].includes(observed?.conclusion)) fail('pending validation closed without matching terminal evidence');
    if (!['live-verified', 'technical-failure', 'editorial-hold', 'approval-hold'].includes(nextSlot.status)) fail('invalid pending validation closeout status');
  }
  if (nextSlot.status === 'live-verified') validateLive(nextSlot, candidate);
}
function validateCurrentSchema(record) {
  const date = record?.date;
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date) fail('current date must be a valid calendar date');
  if (!Array.isArray(record.publications)) fail('current publications must be an array');
  for (const field of ['fullArticleCount', 'alertCount']) if (!Number.isSafeInteger(record[field]) || record[field] < 0) fail(`current ${field} must be a nonnegative integer`);
  for (const item of record.publications) publicationKey(item);
}
function validateCurrentContinuity(previous, candidate) {
  validateCurrentSchema(previous);
  validateCurrentSchema(candidate);
  validatePendingSlots(candidate);
  validatePendingSlots(previous, { allowLegacyAttempt: true });
  const livePublications = new Set();
  for (const slot of candidate.regularPublicationSlots || []) {
    if (slot.status !== 'live-verified') continue;
    const key = publicationKey({ type: 'article', url: slot.url });
    if (livePublications.has(key)) fail('multiple live slots reference the same publication');
    livePublications.add(key);
  }
  if (previous?.date !== candidate?.date) {
    // A new day must satisfy the same identity/count invariants as later writes.
    // Do not admit a rollover that fails its own subsequent no-op reconciliation.
    const identities = new Set(candidate.publications.map(publicationKey));
    if (identities.size !== candidate.publications.length) fail('same-day publication identities are duplicated');
    if (candidate.fullArticleCount !== candidate.publications.filter(p => p.type === 'article').length) fail('fullArticleCount does not match same-day article identities');
    for (const slot of candidate.regularPublicationSlots || []) if (slot.status === 'live-verified') validateLive(slot, candidate);
    return;
  }
  if (!Array.isArray(previous.publications) || !Array.isArray(candidate.publications)) fail('same-day publications must be arrays');
  const next = new Set(candidate.publications.map(publicationKey));
  if (next.size !== candidate.publications.length) fail('same-day publication identities are duplicated');
  for (const publication of previous.publications) if (!next.has(publicationKey(publication))) fail('candidate dropped a same-day publication');
  for (const field of ['fullArticleCount', 'alertCount']) {
    if (Number.isInteger(previous[field]) && (!Number.isInteger(candidate[field]) || candidate[field] < previous[field])) fail(`${field} regressed on the same date`);
  }
  if (Number.isInteger(candidate.fullArticleCount) && candidate.fullArticleCount !== candidate.publications.filter(p => p.type === 'article').length) fail('fullArticleCount does not match same-day article identities');
  // The November 7 catch-up receipts predate regularPublicationSlots. Preserve
  // their completed evidence without retroactively inventing terminal fields.
  for (const oldSlot of previous.catchupSlots || []) {
    const newSlot = (candidate.catchupSlots || []).find(slot => slot.slot === oldSlot.slot);
    if (!newSlot || oldSlot.status === 'live-verified' &&
        (newSlot.status !== 'live-verified' || !preserves(oldSlot, newSlot)))
      fail('candidate dropped or changed a completed catch-up slot receipt');
  }
  for (const oldSlot of previous.regularPublicationSlots || []) validateSlotTransition(oldSlot, (candidate.regularPublicationSlots || []).find(slot => slot.slot === oldSlot.slot), candidate);
  for (const newSlot of candidate.regularPublicationSlots || []) if (newSlot.status === 'live-verified' && !(previous.regularPublicationSlots || []).some(slot => slot.slot === newSlot.slot)) validateLive(newSlot, candidate);
}
// Publisher outcomes must not bypass the checkpoint rules by using
// legacy prose fields. This is transition admission, not a rewrite of history.
function validatePublisherCheckpointAdmission(previous, candidate) {
  const sameDay = previous.date === candidate.date;
  const oldSlots = sameDay ? previous.regularPublicationSlots || [] : [];
  const changed = (candidate.regularPublicationSlots || []).filter(slot =>
    !isDeepStrictEqual(slot, oldSlots.find(old => old.slot === slot.slot)));
  for (const slot of changed) {
    const old = oldSlots.find(value => value.slot === slot.slot);
    const p = pendingOf(slot), oldPending = pendingOf(old);
    if (p?.prNumber !== undefined && !id(p.prNumber)) fail('publisher checkpoint has invalid PR identity');
    if (oldPending?.prNumber !== undefined && p?.prNumber !== oldPending.prNumber) fail('publisher checkpoint lost or changed its PR identity');
    if (p && (!oldPending || !matches(p, oldPending)) && !id(p.prNumber)) fail('new publisher checkpoint lacks exact PR number');
    if (waiting(slot)) {
      if ((!oldPending || !matches(p, oldPending)) && !id(p?.prNumber)) fail('new publisher checkpoint lacks exact PR number');
    } else if (slot.status === 'technical-failure') {
      if (!oldPending || !checkpoint(oldPending)) fail('technical closeout requires a previously persisted exact pending checkpoint');
      const terminal = slot.evidence?.terminalValidation;
      if (!matches(terminal, p) || terminal.conclusion !== 'failure') fail('technical closeout lacks matching failure evidence');
    } else if (slot.status === 'prepared') {
      owned(slot);
      if (oldPending || p || slot.evidence?.terminalValidation || slot.evidence?.terminalAcceptance || slot.verifiedAt || slot.productionCommit)
        fail('prepared candidate cannot replace a checkpoint or claim terminal/production evidence');
      if (candidate.status !== 'in-progress' || typeof slot.candidateTitle !== 'string' || !slot.candidateTitle.trim()) fail('prepared candidate must remain in-progress with its candidate identity');
    } else if (slot.status === 'pre-validation-blocked') {
      owned(slot);
      const blocker = slot.blocker;
      if (oldPending || p || slot.evidence?.terminalValidation) fail('pre-validation blocker cannot replace or invent a validation checkpoint');
      if (!['source-read', 'browser-preflight', 'candidate-preparation', 'github-read'].includes(blocker?.stage) ||
          !dated(blocker?.observedAt) || ![blocker?.reason, blocker?.nextAction].every(value => typeof value === 'string' && value.trim()))
        fail('pre-validation blocker lacks stage, evidence time, reason or bounded next action');
    } else if (['editorial-hold', 'approval-hold'].includes(slot.status)) {
      if (slot.accountableOwner !== 'daily-publisher' || typeof slot.holdReason !== 'string' || !slot.holdReason.trim()) fail('publisher hold lacks owner or explicit hold reason');
      if (!oldPending && (p || slot.evidence?.terminalValidation)) fail('new publisher hold cannot disguise an unpersisted validation checkpoint');
    } else if (slot.status !== 'live-verified') fail('unrecognized publisher slot outcome');
  }
  const prior = sameDay ? previous : {};
  if (!isDeepStrictEqual(prior.validation, candidate.validation)) fail('legacy validation prose is read-only; persist structured slot evidence');
  const fields = ['status', 'blockedReason', 'secondSlot', 'thirdSlot', 'outcomeSlot'];
  const changedFields = fields.filter(key => !isDeepStrictEqual(prior[key], candidate[key]));
  const outcomes = record => (record.candidateEvaluations || []).map(item => ({ title: item.title, status: item.status, blockedReason: item.blockedReason }));
  const oldOutcomes = outcomes(prior), nextOutcomes = outcomes(candidate);
  const evaluationChanged = !isDeepStrictEqual(oldOutcomes, nextOutcomes);
  if (!changedFields.length && !evaluationChanged) return;
  // Starting ordinary work is not a terminal outcome. No technical blocker or
  // candidate disposition may be hidden behind this narrow initial-state case.
  if (!evaluationChanged && changedFields.every(key => key === 'status') && candidate.status === 'in-progress') return;
  // An unrelated article append cannot excuse an unrecorded validation outcome.
  const actionable = changed.filter(slot => slot.status !== 'live-verified' || oldSlots.find(old => old.slot === slot.slot)?.status !== 'live-verified');
  if (!actionable.length) fail('publisher outcome lacks a structured slot transition; persist the pending checkpoint or an explicit hold/blocker');
  if (changedFields.includes('secondSlot') && !actionable.some(slot => slot.slot === 2)) fail('second-slot outcome lacks a matching slot 2 transition');
  if (changedFields.includes('thirdSlot') && !actionable.some(slot => slot.slot === 3)) fail('third-slot outcome lacks a matching slot 3 transition');
  if (changedFields.some(key => ['status', 'blockedReason', 'outcomeSlot'].includes(key)) &&
      (!id(candidate.outcomeSlot) || !actionable.some(slot => slot.slot === candidate.outcomeSlot))) fail('cycle outcome lacks an explicit matching outcomeSlot');
  for (const outcome of nextOutcomes.filter(value => !isDeepStrictEqual(value, oldOutcomes.find(old => old.title === value.title)))) {
    if (!actionable.some(slot => slot.candidateTitle === outcome.title ||
        slot.outcomeScope === 'cycle' && ['editorial-hold', 'approval-hold', 'prepared', 'live-verified'].includes(slot.status)))
      fail('candidate disposition lacks a matching candidateTitle or explicit cycle hold');
  }
}
// Prospective package admission under the checked-out cadence policy. Read-only
// historical no-ops remain valid; exact accepted transitions are handled by the
// CLI's reviewed immutable-pair compatibility rules, never by a date-wide skip.
function validatePublisherCadence(previous, candidate, rules) {
  const maximum = rules?.standardCycle?.fullArticleMaximumPerWeekday;
  const targets = rules?.standardCycle?.fullArticleTargetByWeekday;
  if (!id(maximum) || !targets || typeof targets !== 'object') fail('publisher cadence rules unavailable');
  const sameDay = previous.date === candidate.date;
  const priorSlots = sameDay ? previous.regularPublicationSlots || [] : [];
  const slots = candidate.regularPublicationSlots || [];
  const changed = slots.filter(slot => !isDeepStrictEqual(slot, priorSlots.find(old => old.slot === slot.slot)));
  const priorArticles = new Set((sameDay ? previous.publications : []).filter(item => item.type === 'article').map(publicationKey));
  const added = candidate.publications.filter(item => item.type === 'article' && !priorArticles.has(publicationKey(item)));
  if (!changed.length && !added.length) return;
  const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: 'America/New_York' }).format(new Date(candidate.date + 'T12:00:00Z'));
  const target = targets[weekday] ?? 0;
  if (!id(target) || target > maximum) fail('no ordinary article slots on this weekday');
  if (candidate.fullArticleCount > maximum || changed.some(slot => slot.slot > maximum)) fail('weekday article maximum exceeded');
  if (added.length > 1) fail('article packages must be admitted one at a time');
  const active = changed.filter(slot => ['prepared', 'pending-validation', 'late-validation', 'live-verified'].includes(slot.status) && priorSlots.find(old => old.slot === slot.slot)?.status !== 'live-verified');
  if (active.length > 1) fail('only one sequential article package may advance');
  for (const slot of active) {
    for (let earlier = 1; earlier < slot.slot; earlier++) {
      if (priorSlots.find(old => old.slot === earlier)?.status !== 'live-verified') fail('earlier article slot must already be live before advancing the next package');
    }
    const old = priorSlots.find(value => value.slot === slot.slot);
    if (slot.status === 'prepared' && (typeof slot.url !== 'string' || !slot.url.trim())) fail('prepared article lacks its planned URL');
    if (slot.url && priorArticles.has(publicationKey({ type: 'article', url: slot.url })) && (!old?.url || publicationKey({ type: 'article', url: old.url }) !== publicationKey({ type: 'article', url: slot.url }))) fail('new article slot cannot reuse a prior canonical publication');
    if (slot.url && slots.some(other => other.slot !== slot.slot && other.url && publicationKey({ type: 'article', url: other.url }) === publicationKey({ type: 'article', url: slot.url }))) fail('article slots cannot prepare or validate the same publication');
    if (old?.url && publicationKey({ type: 'article', url: old.url }) !== publicationKey({ type: 'article', url: slot.url })) fail('article checkpoint changed or lost its planned URL');
    if (slot.status === 'live-verified' && !waiting(old)) fail('live article requires its previously persisted validation checkpoint');
    const pending = pendingOf(slot);
    if (pending && slots.some(other => other.slot !== slot.slot && pending.head === pendingOf(other)?.head)) fail('article slots cannot reuse a validation head');
  }
  for (const article of added) {
    if (!active.some(slot => ['prepared', 'live-verified'].includes(slot.status) && slot.url && publicationKey({ type: 'article', url: slot.url }) === publicationKey(article)))
      fail('new article lacks its matching sequential prepared or verified slot');
  }
}
module.exports = { validatePendingSlots, validateCurrentContinuity, validatePublisherCheckpointAdmission, validatePublisherCadence };
