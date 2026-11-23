'use strict';
// Persisted state is JSON. Keep this checker executable in the publisher's
// ordinary functions.exec V8 runtime as well as Node; no filesystem/network API.
function isDeepStrictEqual(a, b) {
  if (Object.is(a, b)) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a) && a.length !== b.length) return false;
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every(key => Object.prototype.hasOwnProperty.call(b, key) && isDeepStrictEqual(a[key], b[key]));
}
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
    if (slot.status === 'validated') validateReady(slot);
  }
}
// The supported persisted URL format is HTTP(S), including existing Alert
// fragments. This bounded parser has identical Node/V8 behavior and rejects
// ambiguous authorities, credentials and control characters.
function canonicalPublicationUrl(value) {
  if (typeof value !== 'string' || !value || /[\s\\\x00-\x1f]/.test(value)) fail('invalid publication URL');
  let absolute = value;
  if (value.startsWith('//')) absolute = 'https:' + value;
  else if (!/^[A-Za-z][A-Za-z0-9+.-]*:/.test(value)) absolute = 'https://creditunionainews.com/' + value.replace(/^\//, '');
  const match = /^(https?):\/\/([A-Za-z0-9.-]+)(?::([0-9]{1,5}))?([^?#]*)([?#].*)?$/i.exec(absolute);
  if (!match || (match[4] && !match[4].startsWith('/')) || (match[3] && +match[3] > 65535)) fail('invalid publication URL');
  const scheme = match[1].toLowerCase(), host = match[2].toLowerCase();
  const port = match[3] && !((scheme === 'https' && +match[3] === 443) || (scheme === 'http' && +match[3] === 80)) ? ':' + Number(match[3]) : '';
  const rawPath = match[4] || '/', pieces = rawPath.split('/'), normalized = [];
  for (let i = 0; i < pieces.length; i++) {
    const segment = pieces[i], dots = segment.replace(/%2e/ig, '.');
    if (dots === '.') { if (i === pieces.length - 1) normalized.push(''); continue; }
    if (dots === '..') { if (normalized.length > 1) normalized.pop(); if (i === pieces.length - 1) normalized.push(''); continue; }
    normalized.push(segment);
  }
  return scheme + '://' + host + port + (normalized.join('/') || '/') + (match[5] || '');
}
function publicationKey(publication) {
  if (!publication || typeof publication.type !== 'string' || typeof publication.url !== 'string') fail('publication lacks stable type/url');
  return `${publication.type}:${canonicalPublicationUrl(publication.url)}`;
}
function validateReady(slot) {
  owned(slot);
  const p = pendingOf(slot), terminal = slot.evidence?.terminalValidation, visual = slot.evidence?.terminalAcceptance;
  if (!checkpoint(p) || !matches(terminal, p) || terminal?.conclusion !== 'success' || !dated(terminal.observedAt) || !matches(visual, p) || !dated(visual?.visualReviewedAt)) fail('validated slot lacks exact terminal and visual evidence');
  if (slot.productionCommit || slot.verifiedAt) fail('validated slot cannot claim production verification');
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
    if (!['validated', 'live-verified', 'technical-failure', 'editorial-hold', 'approval-hold'].includes(nextSlot.status)) fail('invalid pending validation closeout status');
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
function validatePublisherCheckpointAdmission(previous, candidate, rules) {
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
    } else if (slot.status === 'validated') {
      if (!oldPending || !matches(p, oldPending)) fail('validated outcome requires a previously persisted exact pending checkpoint');
      validateReady(slot);
    } else if (slot.status === 'prepared') {
      owned(slot);
      if (oldPending || p || slot.evidence?.terminalValidation || slot.evidence?.terminalAcceptance || slot.verifiedAt || slot.productionCommit)
        fail('prepared candidate cannot replace a checkpoint or claim terminal/production evidence');
      if ((candidate.status !== 'in-progress' && !(candidate.afternoonSupplement && activeSupplementSlot(slot))) || typeof slot.candidateTitle !== 'string' || !slot.candidateTitle.trim()) fail('prepared candidate must remain in-progress with its candidate identity');
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
  // Completing a fully live core cycle after the bounded optional selector returns
  // none is aggregate bookkeeping, not a new publication outcome. Admit only
  // that exact transition; never invent optional slots or bypass a checkpoint.
  const aggregateOnly = sameDay && !evaluationChanged && !changed.length &&
    prior.status === 'in-progress' && candidate.status === 'completed' &&
    changedFields.length === 1 && changedFields[0] === 'status';
  if (aggregateOnly) {
    const { target, maximum } = articleLimits(candidate, rules);
    const slots = candidate.regularPublicationSlots || [];
    if (morningArticleProfile(rules?.standardCycle, candidate.date)) {
      if (candidate.fullArticleCount !== target || candidate.outcomeSlot !== target || candidate.blockedReason !== undefined ||
          candidate.publications.filter(item => item.type === 'article').length !== target ||
          !Array.from({ length: target }, (_, i) => i + 1).every(n => slots.find(slot => slot.slot === n)?.status === 'live-verified'))
        fail('morning cycle completion requires every target slot live, or an explicit qualified hold/blocker');
      return;
    }
    const optional = candidate.optionalSelection;
    const coreLive = Array.from({ length: target }, (_, index) => index + 1)
      .every(number => slots.find(slot => slot.slot === number)?.status === 'live-verified');
    const articleCount = (candidate.publications || []).filter(item => item.type === 'article').length;
    const poolMaximum = rules?.standardCycle?.maximumCandidatesToEvaluate;
    if (!coreLive || candidate.fullArticleCount !== target || articleCount !== target ||
        candidate.outcomeSlot !== target || candidate.blockedReason !== undefined ||
        slots.some(slot => slot.slot > target) ||
        optional?.decision !== 'none-qualified' || optional.coreLiveCount !== target ||
        optional.maximum !== maximum || !Array.isArray(optional.selected) || optional.selected.length ||
        !id(optional.candidatePoolCount) || !id(poolMaximum) || optional.candidatePoolCount > poolMaximum ||
        !dated(optional.selectorObservedAt) || typeof optional.reason !== 'string' || !optional.reason.trim())
      fail('completed aggregate closeout requires all core slots live and an exact none-qualified optional selection');
    return;
  }
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
function morningArticleProfile(standard, date) {
  const p = standard?.morningArticleCycle;
  if (!p || date < p.effectiveDate) return null;
  if (typeof p.effectiveDate !== 'string' || !/^\d{4}-\d\d-\d\d$/.test(p.effectiveDate) ||
      !['dailyTargetAndMaximum','weeklyMaximum','candidateTarget','candidateMaximum','backupTarget',
        'preferredMaximumPerPrimaryFunctionPerWeek','preferredMaximumPerActualTechnologyPerWeek'].every(k => id(p[k])) ||
      p.weeklyMaximum !== p.dailyTargetAndMaximum * 7 || p.candidateMaximum < p.candidateTarget ||
      p.candidateTarget < p.dailyTargetAndMaximum + p.backupTarget) fail('morning article profile inconsistent');
  return p;
}
function articleDayTarget(standard, date) {
  const morning = morningArticleProfile(standard, date);
  if (morning) return morning.dailyTargetAndMaximum;
  const day = new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: 'America/New_York' }).format(new Date(date + 'T12:00:00Z'));
  const weekend = standard?.weekendArticles;
  if (day === 'Saturday' || day === 'Sunday') return typeof weekend?.effectiveDate === 'string' && date >= weekend.effectiveDate ? weekend.targetByDay?.[day] ?? 0 : 0;
  return standard?.fullArticleTargetByWeekday?.[day] ?? 0;
}
function articleDayMaximum(standard, date) {
  const target = articleDayTarget(standard, date);
  if (!target) return 0;
  const morning = morningArticleProfile(standard, date);
  const extras = standard?.optionalExtras;
  return morning ? morning.dailyTargetAndMaximum :
    extras && date < extras.effectiveDate ? extras.previousMaximumPerWeekday : standard?.fullArticleMaximumPerWeekday;
}
function articleWeekStart(date) {
  const day = new Date(date + 'T12:00:00Z');
  day.setUTCDate(day.getUTCDate() - (day.getUTCDay() + 6) % 7);
  return day.toISOString().slice(0, 10);
}
const eventIdentity = value => typeof value === 'string' ? value.trim().toLowerCase().replace(/[^a-z0-9]+/g,' ').trim() : '';
function candidateInventoryKey(entry) {
  const candidateId = typeof entry?.candidateId === 'string' ? entry.candidateId.trim() : '';
  const eventKey = eventIdentity(entry?.eventKey);
  return candidateId && eventKey ? JSON.stringify([candidateId,eventKey]) : '';
}
function sourceTimestamp(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\d(?:T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d+)?)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d))?$/.test(value)) return NaN;
  const date = value.slice(0,10), calendar = Date.parse(date + 'T12:00:00Z');
  return Number.isFinite(calendar) && new Date(calendar).toISOString().slice(0,10) === date ? Date.parse(value) : NaN;
}
// Single owner-approved November 23 continuation; never reuse as a general
// reopen feature. Evidence times are replayable in first-parent history.
const supplementDay = '2026-11-23';
const supplementApproval = 'Sentinel_de3e44c4f080819180e75054f8ee1dfa';
const supplementStart = Date.parse('2026-11-23T20:34:00Z');
const supplementEnd = Date.parse('2026-11-24T05:00:00Z');
const supplementTime = value => dated(value) && Date.parse(value) >= supplementStart && Date.parse(value) < supplementEnd;
const supplementReceipt = 'https://github.com/thomaschurchadams-eng/work-feel/issues/160#issuecomment-7098352141';
const activeSupplementSlot = slot => slot?.slot >= 2 && ['prepared','pending-validation','late-validation','validated','live-verified'].includes(slot.status);
const morningSnapshot = record => Object.fromEntries(Object.entries(record).filter(([k]) => !['alertCount','afternoonSupplement'].includes(k)).map(([k,v]) => [k,k === 'publications' ? v.filter(row=>row.type==='article') : v]));
function validateAfternoonSupplement(previous, candidate) {
  const earlier = previous.afternoonSupplement, next = candidate.afternoonSupplement;
  if (previous.date !== candidate.date) {
    if (next) fail('afternoon supplement cannot be opened on rollover or another date');
    return;
  }
  if (!next && !earlier) {
    if ((candidate.regularPublicationSlots || []).some(slot=>slot.evidence?.afternoonSupplement)) fail('afternoon slot requires its owned supplement record');
    return;
  }
  if (candidate.date !== supplementDay || next?.approval !== supplementApproval || next?.closedMorningReceipt !== supplementReceipt ||
      next?.owner !== 'daily-publisher' || !supplementTime(next?.openedAt) || candidate.status !== 'held' || candidate.outcomeSlot !== 2)
    fail('afternoon supplement does not match its date, owner, approval and closed morning receipt');
  if (!earlier) {
    const original = previous.regularPublicationSlots || [];
    if (previous.status !== 'held' || previous.fullArticleCount !== 1 || previous.shortfall?.target !== 10 || previous.shortfall?.live !== 1 ||
        original.length !== 10 || original[0].status !== 'live-verified' || original[0].url !== 'https://creditunionainews.com/insight-credit-union-ai-survey-evidence.html' ||
        original[0].productionCommit !== '4969fe37355b183d78bee45aa15bdf55a7a9aca5' ||
        !original.slice(1).every(x=>x.status==='editorial-hold') || !isDeepStrictEqual(next.morningSnapshot,morningSnapshot(previous)))
      fail('afternoon supplement requires the immutable 1-of-10 morning baseline');
  } else if (!isDeepStrictEqual(next.morningSnapshot,earlier.morningSnapshot) || next.openedAt !== earlier.openedAt ||
      (earlier.closedAt && !isDeepStrictEqual(next,earlier))) fail('afternoon supplement lost immutable original evidence or was already closed');
  const day = next.morningSnapshot;
  for (const key of ['shortfall','status','outcomeSlot','discoveryCoverage','candidateEvaluations','evaluatedCandidateCount','beatsSearched','browserReadiness','socialDecision'])
    if (!isDeepStrictEqual(day[key],candidate[key])) fail('afternoon supplement cannot rewrite the closed morning disposition');
  if (!isDeepStrictEqual(day.regularPublicationSlots[0],candidate.regularPublicationSlots?.[0]))
    fail('afternoon supplement cannot rewrite the morning publication');
  const inventory = next.candidateInventory, keys = Array.isArray(inventory) ? inventory.map(candidateInventoryKey) : [];
  if (!keys.length || keys.length > 30 || keys.includes('') || new Set(keys).size !== keys.length ||
      new Set(inventory.map(x=>x.candidateId.trim())).size !== keys.length || new Set(inventory.map(x=>eventIdentity(x.eventKey))).size !== keys.length ||
      (earlier && !isDeepStrictEqual(earlier.candidateInventory,inventory.slice(0,earlier.candidateInventory.length))))
    fail('afternoon supplement requires a distinct append-only source inventory');
  const slots = candidate.regularPublicationSlots || [];
  const active = slots.filter(activeSupplementSlot);
  if (active.length > 9) fail('afternoon supplement maximum exceeded');
  for (const slot of active) {
    const evidence = slot.evidence?.afternoonSupplement;
    const original = (previous.regularPublicationSlots || []).find(row=>row.slot===slot.slot);
    if (slot.accountableOwner !== 'daily-publisher' || evidence?.approval !== supplementApproval || !supplementTime(evidence.preparedAt) ||
        Date.parse(evidence.preparedAt) < Date.parse(next.openedAt) ||
        (activeSupplementSlot(original) && !isDeepStrictEqual(evidence,original.evidence?.afternoonSupplement)) ||
        (earlier?.closedAt && !isDeepStrictEqual(slot,original)))
      fail('afternoon article lacks its exact approved slot and real same-day preparation time');
    for (const time of [slot.evidence?.terminalValidation?.observedAt,slot.evidence?.terminalAcceptance?.visualReviewedAt,slot.verifiedAt].filter(t=>t!==undefined))
      if (!supplementTime(time) || Date.parse(time) < Date.parse(evidence.preparedAt))
        fail('afternoon article evidence is outside the authorized release window');
  }
  if (next.closedAt && (!supplementTime(next.closedAt) || Date.parse(next.closedAt) < Date.parse(next.openedAt) || active.some(slot=>slot.status!=='live-verified')))
    fail('afternoon supplement cannot close with an in-flight checkpoint');
}
function requireOpenAfternoonReview(record,slot,now) {
  if (!slot.evidence?.afternoonSupplement) return;
  if (record.date !== supplementDay || record.afternoonSupplement?.closedAt || !supplementTime(now))
    fail('November 23 afternoon publication window has ended');
}
function validateMorningSelection(slot, record, profile) {
  const supplement = slot.evidence?.afternoonSupplement ? record.afternoonSupplement : null;
  const inventory = supplement?.candidateInventory ?? record.discoveryCoverage?.candidateInventory;
  const e = slot.evidence?.articleSelection;
  if (!candidateInventoryKey(e) || !/^https:\/\/[^\s/@]+(?:\/[^\s]*)?$/.test(e.sourceUrl || '') ||
      !Number.isFinite(sourceTimestamp(e.sourcePublishedAt)))
    fail('morning article requires a stable event identity and primary-source receipt');
  const keys = Array.isArray(inventory) ? inventory.map(candidateInventoryKey) : [];
  if (record.discoveryCoverage?.date !== record.date || !keys.length || keys.length > profile.candidateMaximum ||
      keys.length !== (supplement ? supplement.candidateInventory.length : record.discoveryCoverage?.candidateCount) || keys.includes('') || new Set(keys).size !== keys.length ||
      new Set(inventory.map(x=>x.candidateId.trim())).size !== keys.length ||
      new Set(inventory.map(x=>eventIdentity(x.eventKey))).size !== keys.length ||
      !inventory.some(row=>candidateInventoryKey(row)===candidateInventoryKey(e) && row.sourceUrl===e.sourceUrl && row.sourcePublishedAt===e.sourcePublishedAt))
    fail('morning article must match the canonical shared candidate inventory');
}
function validateMorningArticleWeek(state, rules) {
  const current = state.current, profile = morningArticleProfile(rules?.standardCycle, current.date);
  if (!profile) return;
  const seen = new Set();
  const lookback = new Date(Date.parse(current.date + 'T12:00:00Z') - rules.selection.lookbackDays * 86400000).toISOString().slice(0,10);
  for (const record of [...state.history.filter(day => day.date >= lookback && day.date < current.date),current]) {
    for (const slot of record.regularPublicationSlots || []) {
      if (record !== current && slot.status !== 'live-verified') continue;
      const key = eventIdentity(slot.evidence?.articleSelection?.eventKey);
      if (!key) continue;
      if (seen.has(key)) fail('article event identity duplicates a retained article package');
      seen.add(key);
    }
  }
  const monday = articleWeekStart(current.date);
  const prior = state.history.filter(day => day.date >= monday && day.date < current.date)
    .reduce((count, day) => count + Math.max(day.fullArticleCount || 0, (day.publications || []).filter(item => item.type === 'article').length), 0);
  const opened = (current.regularPublicationSlots || []).filter(slot => ['prepared','pending-validation','late-validation','validated'].includes(slot.status));
  if (prior + Math.max(current.fullArticleCount, current.publications.filter(item => item.type === 'article').length) + opened.length > profile.weeklyMaximum)
    fail('Eastern Monday–Sunday article maximum exceeded');
  for (const slot of opened) validateMorningSelection(slot,current,profile);
}
// The dated exception requires the same verified baseline on every new package.
function articleLimits(record, rules) {
  const standard = rules?.standardCycle, exception = standard?.oneTimeException;
  const target = articleDayTarget(standard, record.date);
  const maximum = articleDayMaximum(standard, record.date);
  if (!Number.isSafeInteger(maximum) || !standard?.fullArticleTargetByWeekday) fail('publisher cadence rules unavailable');
  if (record.date === exception?.date) {
    const baseline = (record.regularPublicationSlots || []).find(slot => slot.slot === 1);
    const found = (record.publications || []).some(item => item.type === 'article' && publicationKey(item) === publicationKey({ type: 'article', url: exception.baselineArticleUrl }));
    if (exception.baselineArticleCount !== 1 || exception.additionalArticleMaximum !== 5 || exception.baselineAlertCount !== 0 || exception.additionalAlertMaximum !== 3 ||
        record.fullArticleCount < exception.baselineArticleCount || !found || baseline?.status !== 'live-verified' ||
        publicationKey({ type: 'article', url: baseline.url }) !== publicationKey({ type: 'article', url: exception.baselineArticleUrl }) ||
        baseline.productionCommit !== exception.baselineProductionCommit || baseline.evidence?.pending?.head !== exception.baselineHead)
      fail('one-time exception requires the frozen verified baseline');
    return { target: exception.baselineArticleCount + exception.additionalArticleMaximum, maximum: exception.baselineArticleCount + exception.additionalArticleMaximum };
  }
  if (standard.effectiveDate && record.date < standard.effectiveDate) fail('no retrospective article cycle');
  return { target, maximum };
}
function validateOptionalSelection(slot, record, rules) {
  const { target, maximum } = articleLimits(record, rules);
  if (slot.slot <= target) return;
  const selection = slot.evidence?.optionalSelection;
  if (slot.slot > maximum || !selection || !['reason', 'distinctValue'].every(key => typeof selection[key] === 'string' && selection[key].trim()) ||
      !Array.isArray(selection.sourceUrls) || !selection.sourceUrls.length || !selection.sourceUrls.every(url => typeof url === 'string' && /^https:\/\/[^\s/@]+(?:\/[^\s]*)?$/.test(url)))
    fail('optional extra requires source-backed strength and distinct value');
}
// Prospective package admission under the checked-out cadence policy. Read-only
// historical no-ops remain valid; exact accepted transitions are handled by the
// CLI's reviewed immutable-pair compatibility rules, never by a date-wide skip.
function validatePublisherCadence(previous, candidate, rules) {
  const sameDay = previous.date === candidate.date;
  const priorSlots = sameDay ? previous.regularPublicationSlots || [] : [];
  const slots = candidate.regularPublicationSlots || [];
  const changed = slots.filter(slot => !isDeepStrictEqual(slot, priorSlots.find(old => old.slot === slot.slot)));
  const priorArticles = new Set((sameDay ? previous.publications : []).filter(item => item.type === 'article').map(publicationKey));
  const added = candidate.publications.filter(item => item.type === 'article' && !priorArticles.has(publicationKey(item)));
  const morning = morningArticleProfile(rules?.standardCycle, candidate.date);
  if (morning && sameDay && previous.status === 'completed' &&
      (candidate.status === 'in-progress' || added.length || changed.some(slot => !priorSlots.some(old => old.slot === slot.slot))))
    fail('completed morning article cycle cannot be reopened');
  if (morning && candidate.status === 'completed' && (candidate.status !== previous.status || !sameDay) &&
      (candidate.fullArticleCount !== morning.dailyTargetAndMaximum ||
       !Array.from({ length: morning.dailyTargetAndMaximum }, (_, i) => i+1).every(n => slots.find(slot => slot.slot === n)?.status === 'live-verified')))
    fail('morning cycle completion requires every target slot live, or an explicit qualified hold/blocker');
  const priorInventory = sameDay ? previous.discoveryCoverage?.candidateInventory : undefined;
  const inventory = candidate.discoveryCoverage?.candidateInventory;
  if (morning && priorInventory && !isDeepStrictEqual(priorInventory,inventory))
    fail('canonical morning candidate inventory cannot be replaced or changed');
  // Check before the no-slot-change return: a legacy-started day cannot be
  // converted by installing only the new inventory as a first write.
  if (morning && sameDay && !priorInventory && (inventory || changed.length || added.length) &&
      (priorSlots.length || previous.discoveryCoverage || previous.fullArticleCount > 0))
    fail('existing daily cycle has no v11 inventory; do not change its cadence mid-cycle');
  if (!changed.length && !added.length) return;
  if (candidate.date === rules?.standardCycle?.oneTimeException?.date) {
    if (!sameDay) fail('one-time exception requires existing same-day baseline');
    articleLimits(previous, rules);
  }
  const { target, maximum } = articleLimits(candidate, rules);
  if (!id(target) || target > maximum) fail('no ordinary article slots on this weekday');
  if (candidate.fullArticleCount > maximum || changed.some(slot => slot.slot > maximum)) fail('weekday article maximum exceeded');
  if (added.length > 1) fail('article packages must be admitted one at a time');
  for (const slot of changed) {
    const priorSelection = priorSlots.find(old => old.slot === slot.slot)?.evidence?.optionalSelection;
    if (priorSelection && !preserves(priorSelection, slot.evidence?.optionalSelection)) fail('optional selection evidence changed or removed');
    const original = priorSlots.find(old => old.slot === slot.slot)?.evidence?.articleSelection;
    if (morning && original && !isDeepStrictEqual(original, slot.evidence?.articleSelection)) fail('article selection evidence changed or removed');
  }
  const active = changed.filter(slot => ['prepared', 'pending-validation', 'late-validation', 'validated', 'live-verified'].includes(slot.status) && priorSlots.find(old => old.slot === slot.slot)?.status !== 'live-verified');
  if (active.length > 1) fail('only one sequential article package may advance');
  for (const slot of active) {
    validateOptionalSelection(slot, candidate, rules);
    if (morning) {
      validateMorningSelection(slot,candidate,morning);
    }
    if (slot.slot > target && !priorSlots.some(old => old.slot === slot.slot) && sameDay && previous.status !== 'in-progress')
      fail('optional extra cannot reopen a completed or held cycle');
    for (let earlier = 1; earlier < slot.slot; earlier++) {
      if (priorSlots.find(old => old.slot === earlier)?.status !== 'live-verified') fail('earlier article slot must already be live before advancing the next package');
    }
    const old = priorSlots.find(value => value.slot === slot.slot);
    if (slot.status !== 'live-verified' && candidate.fullArticleCount >= maximum && slot.url && !priorArticles.has(publicationKey({ type: 'article', url: slot.url }))) fail('weekday article capacity is already reserved or published');
    if (slot.status === 'prepared' && (typeof slot.url !== 'string' || !slot.url.trim())) fail('prepared article lacks its planned URL');
    if (slot.url && priorArticles.has(publicationKey({ type: 'article', url: slot.url })) && (!old?.url || publicationKey({ type: 'article', url: old.url }) !== publicationKey({ type: 'article', url: slot.url }))) fail('new article slot cannot reuse a prior canonical publication');
    if (slot.url && slots.some(other => other.slot !== slot.slot && other.url && publicationKey({ type: 'article', url: other.url }) === publicationKey({ type: 'article', url: slot.url }))) fail('article slots cannot prepare or validate the same publication');
    if (old?.url && publicationKey({ type: 'article', url: old.url }) !== publicationKey({ type: 'article', url: slot.url })) fail('article checkpoint changed or lost its planned URL');
    if (slot.status === 'live-verified' && old?.status !== 'validated') fail('live article requires its previously persisted validated checkpoint');
    const pending = pendingOf(slot);
    if (pending && slots.some(other => other.slot !== slot.slot && pending.head === pendingOf(other)?.head)) fail('article slots cannot reuse a validation head');
  }
  for (const article of added) {
    if (!active.some(slot => slot.status === 'live-verified' && slot.url && publicationKey({ type: 'article', url: slot.url }) === publicationKey(article)))
      fail('new article lacks its matching sequential verified slot');
  }
}
// Shared by the Git CLI and the connector-only pre-write planner. Historical
// immutable-pair compatibility stays in the Git CLI, where exact refs are read.
function validateStateHistory(base, candidate) {
  validateCurrentContinuity(base.current, candidate.current);
  for (const entry of candidate.history || []) validatePendingSlots(entry, { allowLegacyAttempt: true });
  if (!Array.isArray(base.history)) fail('base state does not contain a history array');
  if (!Array.isArray(candidate.history)) fail('candidate state does not contain a history array');
  if (candidate.history.length < base.history.length) fail(`history shrank from ${base.history.length} entries to ${candidate.history.length}`);
  const byDate = new Map();
  for (const entry of candidate.history) {
    if (!entry?.date) continue;
    if (byDate.has(entry.date)) fail(`candidate contains duplicate history date: ${entry.date}`);
    byDate.set(entry.date, entry);
  }
  for (const entry of base.history) {
    if (!entry?.date) continue;
    if (!byDate.has(entry.date)) fail(`candidate dropped existing history date: ${entry.date}`);
    if (!isDeepStrictEqual(byDate.get(entry.date), entry)) fail(`candidate mutated existing history entry: ${entry.date}`);
  }
  if (base.current?.date && candidate.current?.date && candidate.current.date < base.current.date) fail(`current date regressed from ${base.current.date} to ${candidate.current.date}`);
  if (base.current?.date && candidate.current?.date && candidate.current.date > base.current.date) {
    if (!byDate.has(base.current.date)) fail(`candidate advanced current date to ${candidate.current.date} without preserving prior current ${base.current.date} in history`);
    if (!isDeepStrictEqual(byDate.get(base.current.date), base.current)) fail(`candidate advanced current date to ${candidate.current.date} but did not preserve the complete prior current ${base.current.date}`);
  }
}
function validateAlertCadence(previous, candidate, rules) {
  const prior = previous.date === candidate.date ? previous.alertCount : 0;
  const before = new Set((previous.date === candidate.date ? previous.publications : []).filter(item => item.type === 'alert').map(publicationKey));
  const added = candidate.publications.filter(item => item.type === 'alert' && !before.has(publicationKey(item)));
  if (candidate.alertCount === prior && !added.length) return;
  const standard = rules?.standardCycle, exception = standard?.oneTimeException;
  const day = new Date(candidate.date + 'T12:00:00Z').getUTCDay();
  if (day === 0 || day === 6 || (standard?.effectiveDate && candidate.date < standard.effectiveDate && candidate.date !== exception?.date)) fail('no retrospective or weekend Alert cycle');
  if (!id(standard?.alertMaximumPerWeekday)) fail('Alert cadence rules unavailable');
  const maximum = candidate.date === exception?.date ? exception.baselineAlertCount + exception.additionalAlertMaximum : standard.alertMaximumPerWeekday;
  if (candidate.date === exception?.date) {
    if (previous.date !== candidate.date) fail('one-time exception requires existing same-day baseline');
    articleLimits(previous, rules);
    articleLimits(candidate, rules);
  }
  if (candidate.alertCount > maximum) fail('weekday Alert maximum exceeded');
  if (candidate.alertCount - prior !== added.length) fail('Alert count does not match new publication identities');
}
function validateStatePreservation(base, candidate, rules) {
  validateStateHistory(base, candidate);
  validateAfternoonSupplement(base.current, candidate.current);
  validatePublisherCheckpointAdmission(base.current, candidate.current, rules);
  validatePublisherCadence(base.current, candidate.current, rules);
  validateMorningArticleWeek(candidate, rules);
  validateAlertCadence(base.current, candidate.current, rules);
}
module.exports = { requireOpenAfternoonReview, validateAlertCadence, articleLimits, articleDayTarget, articleDayMaximum, articleWeekStart, morningArticleProfile, candidateInventoryKey, sourceTimestamp, validateMorningArticleWeek, validateOptionalSelection, canonicalPublicationUrl, isDeepStrictEqual, validatePendingSlots, validateCurrentContinuity, validatePublisherCheckpointAdmission, validatePublisherCadence, validateStateHistory, validateStatePreservation };
