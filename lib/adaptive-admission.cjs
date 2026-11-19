'use strict';
// Read-only admission advice. Receipts describe evidence; they cannot grant authority,
// clear a hold, change a model/cap, or replace actual editorial/perceptual review.
const { createHash } = require('node:crypto');
const text = x => typeof x === 'string' && x.trim().length > 0;
const count = x => Number.isInteger(x) && x >= 0;
const amount = x => typeof x === 'number' && Number.isFinite(x) && x >= 0;
const instant = x => typeof x === 'string' && /(?:Z|[+-]\d\d:\d\d)$/.test(x) && Number.isFinite(Date.parse(x));
const eastern = x => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date(x));
const digest = x => createHash('sha256').update(JSON.stringify(x)).digest('hex');
const result = (decision, reasons, extra = {}) => ({ decision, reasons, ...extra, releaseReady: false, writes: 0, authorityVerified: false });
function snapshot({ rules, state, growth }) {
  return digest({ rules, current: state.current, activeExperiments: growth.activeExperiments,
    closedExperimentIds: growth.closedExperiments.map(x => x.id), experimentAdmission: growth.experimentAdmission });
}
function evidenceProblems(e, context, now, scope) {
  const reasons = [], scopes = Array.isArray(scope) ? scope : [scope];
  if (!instant(now)) throw Error('actual-observation-time-required');
  if (!e || e.snapshot !== snapshot(context)) reasons.push('missing-or-stale-source-snapshot');
  if (!instant(e?.observedAt) || Date.parse(e.observedAt) > Date.parse(now) || eastern(e.observedAt) !== eastern(now)) reasons.push('current-dated-evidence-required');
  if (!text(e?.reviewRef) || !['daily-publisher', 'cuai-operating-system'].includes(e?.owner)) reasons.push('owned-evidence-review-required');
  if (!Array.isArray(e?.incidents)) reasons.push('incident-status-unknown');
  else for (const incident of e.incidents) {
    if (!incident || !['article', 'experiment', 'model', 'all'].includes(incident.scope) || !['serious', 'minor'].includes(incident.severity) ||
        !['open', 'resolved'].includes(incident.status) || !text(incident.reference)) reasons.push('invalid-incident-evidence');
    else if (incident.status === 'open' && incident.severity === 'serious' && (scopes.includes('all') || incident.scope === 'all' || scopes.includes(incident.scope))) reasons.push('serious-unresolved-incident');
  }
  if (!Array.isArray(e?.resources) || !e.resources.length) reasons.push('verified-resource-budget-required');
  else for (const resource of e.resources) {
    if (!resource || !text(resource.name) || !text(resource.unit) || !text(resource.reference) || !text(resource.requirementRef) ||
        !amount(resource.available) || !amount(resource.requiredPerItem) || resource.requiredPerItem === 0 ||
        !instant(resource.observedAt) || Date.parse(resource.observedAt) > Date.parse(e.observedAt) || eastern(resource.observedAt) !== eastern(now) ||
        !instant(resource.validUntil) || Date.parse(resource.validUntil) <= Date.parse(now)) reasons.push('unknown-or-expired-resource-evidence');
  }
  return [...new Set(reasons)];
}
const resourceCapacity = e => Math.min(...e.resources.map(x => Math.floor(x.available / x.requiredPerItem)));
function optionalAdmission(context, e, now) {
  const { rules, state } = context, current = state.current, date = eastern(now);
  const day = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'long' }).format(new Date(now));
  const core = rules.standardCycle.fullArticleTargetByWeekday[day] || 0, extra = rules.standardCycle.optionalExtras;
  const reasons = evidenceProblems(e, context, now, 'article');
  if (e?.owner !== 'daily-publisher') reasons.push('same-publisher-required');
  if (!core || date < extra.effectiveDate) reasons.push('optional-capacity-not-active');
  if (current.date !== date || current.status !== 'in-progress') reasons.push('current-open-cycle-required');
  const slots = current.regularPublicationSlots || [];
  if (slots.some(x => ['pending-validation', 'validated', 'prepared', 'technical-failure', 'pre-validation-blocked'].includes(x.status))) reasons.push('resolve-owned-package-first');
  const live = slots.filter(x => x.plannedDate === date && x.status === 'live-verified' && x.accountableOwner === 'daily-publisher' &&
    /^[a-f0-9]{40}$/.test(x.productionCommit || '') && instant(x.verifiedAt) && eastern(x.verifiedAt) === date && Date.parse(x.verifiedAt) <= Date.parse(now) &&
    x.evidence?.terminalValidation?.conclusion === 'success' && instant(x.evidence?.terminalAcceptance?.visualReviewedAt) &&
    Date.parse(x.evidence.terminalAcceptance.visualReviewedAt) <= Date.parse(x.verifiedAt));
  if (Array.from({ length: core }, (_, i) => i + 1).some(n => live.filter(x => x.slot === n).length !== 1) ||
      current.fullArticleCount !== live.length || new Set(live.map(x => x.url)).size !== live.length) reasons.push('core-live-evidence-incomplete');
  const remaining = Math.max(0, Math.min(extra.maximum, rules.standardCycle.fullArticleMaximumPerWeekday - current.fullArticleCount));
  const capacity = reasons.length ? 0 : Math.min(remaining, resourceCapacity(e));
  if (!reasons.length && !capacity) reasons.push('no-remaining-verified-capacity');
  return result(reasons.includes('serious-unresolved-incident') ? 'stop-discretionary' : capacity ? 'within-current-optional-cap' : 'no-optional-capacity',
    [...new Set(reasons)], { optionalCapacity: capacity, sourceSnapshot: snapshot(context), coreTargetUnchanged: core, optionalQuota: false });
}
function taskProblems(task, now) {
  const reasons = [];
  if (!text(task?.runId) || !text(task?.evidenceRef) || !['live-verified', 'qualified-hold', 'technical-failure'].includes(task?.outcome)) reasons.push('real-task-receipt-required');
  if (!instant(task?.startedAt) || !instant(task?.completedAt) || Date.parse(task.completedAt) < Date.parse(task.startedAt) || Date.parse(task.completedAt) > Date.parse(now)) reasons.push('total-elapsed-time-unknown');
  if (!amount(task?.usage?.value) || !text(task?.usage?.unit) || !text(task?.usage?.reference) || !amount(task?.cost?.value) || !text(task?.cost?.currency) || !text(task?.cost?.reference)) reasons.push('usage-or-cost-unknown');
  if (!count(task?.retries) || !count(task?.humanInterventions)) reasons.push('retry-or-intervention-evidence-unknown');
  const q = task?.quality;
  if (q?.accepted !== true || !count(q.defects) || !text(q.reviewer) || !text(q.criteriaRef) || !text(q.observations) || !/^[a-f0-9]{64}$/.test(q.artifactSha256 || '') || !text(q.reviewRef)) reasons.push('actual-output-review-required');
  if (task?.outcome === 'technical-failure') reasons.push('technical-failure');
  if (task?.outcome === 'qualified-hold' && !text(task.holdReason)) reasons.push('qualified-hold-reason-required');
  return reasons;
}
function reviewAdmission(input, context, now) {
  if (!['experiment', 'limit-increase', 'model-comparison'].includes(input?.kind)) throw Error('known-admission-kind-required');
  const scope = input.kind === 'experiment' ? ['experiment', ...(Array.isArray(input.actions) ? input.actions : []).map(action => ({
    'private-model-comparison': 'model', 'private-editorial-review': 'article', 'private-workflow-test': 'all'
  })[action]).filter(Boolean)] : input.kind === 'model-comparison' ? 'model' : input.limit === 'articles' ? 'article' : 'experiment';
  const reasons = evidenceProblems(input.evidence, context, now, scope);
  if (reasons.length) return result(reasons.includes('serious-unresolved-incident') ? 'stop-discretionary' : 'evidence-incomplete', reasons);
  if (resourceCapacity(input.evidence) < 1) return result('no-resource-capacity', ['existing-resource-budget-exhausted']);
  const { growth, rules } = context;
  const cap = growth.experimentAdmission?.maximumActive;
  if (!count(cap) || !Array.isArray(growth.activeExperiments)) return result('evidence-incomplete', ['active-experiment-cap-unknown']);
  if (input.kind === 'experiment') {
    if (!['daily-publisher', 'cuai-operating-system'].includes(input.evidence.owner)) reasons.push('existing-accountable-owner-required');
    if (!text(input.id) || [...growth.activeExperiments, ...growth.closedExperiments].some(x => x.id === input.id)) reasons.push('duplicate-or-closed-experiment');
    if (growth.activeExperiments.length >= cap) reasons.push('active-experiment-cap-reached');
    for (const field of ['hypothesis', 'comparisonRef', 'measure', 'successCriterion', 'stopCriterion', 'rollback', 'authorityRef']) if (!text(input[field])) reasons.push('experiment-' + field + '-required');
    if (!instant(input.reviewAt) || Date.parse(input.reviewAt) <= Date.parse(now)) reasons.push('owned-future-review-required');
    // This gate prepares private editorial/workflow/model evaluations only. It cannot
    // revive distribution experiments or authorize any external action/configuration.
    if (!Array.isArray(input.actions) || !input.actions.length || input.actions.some(x => !['private-editorial-review', 'private-workflow-test', 'private-model-comparison'].includes(x))) reasons.push('action-outside-private-admission-scope');
    return result(reasons.length ? 'not-admitted' : 'eligible-for-owner-admission', reasons, { activeExperiments: growth.activeExperiments.length, maximumActiveExperiments: cap, configuredModelChange: false });
  }
  if (!text(input.plan?.reference) || !text(input.plan?.rationale) || !Array.isArray(input.plan?.taskIds) || !input.plan.taskIds.length ||
      input.plan.taskIds.some(x => !text(x)) || new Set(input.plan.taskIds).size !== input.plan.taskIds.length) reasons.push('predeclared-representative-task-plan-required');
  if (reasons.length) return result('evidence-incomplete', reasons);
  const rows = input.kind === 'model-comparison' ? input.pairs : input.runs;
  if (!Array.isArray(rows) || !rows.length || rows.length !== input.plan?.taskIds?.length ||
      input.plan.taskIds.some(id => rows.filter(x => x?.taskId === id).length !== 1)) reasons.push('complete-planned-evidence-required');
  if (reasons.length) return result('evidence-incomplete', reasons);
  if (input.kind === 'limit-increase') {
    const current = input.limit === 'articles' ? rules.standardCycle.fullArticleMaximumPerWeekday : input.limit === 'experiments' ? cap : null;
    if (input.limit === 'articles' && eastern(now) < rules.standardCycle.optionalExtras.effectiveDate) reasons.push('current-optional-limit-not-yet-active');
    if (current === null || input.proposedLimit !== current + 1) reasons.push('one-step-only-from-current-limit');
    for (const row of rows) reasons.push(...taskProblems(row, now));
    if (new Set(rows.map(x => x.runId)).size !== rows.length) reasons.push('duplicate-run-evidence');
    if (rows.some(x => x.policyVersion !== rules.version)) reasons.push('current-policy-real-use-required');
    for (const field of ['independentReviewRef', 'qualifiedDemandRef', 'rollback', 'previousChangeOutcomeRef']) if (!text(input[field])) reasons.push(field + '-required');
    if (!count(input.distinctQualifiedDeferred) || input.distinctQualifiedDeferred < 1) reasons.push('qualified-demand-not-established');
    if (!instant(input.reviewAt) || Date.parse(input.reviewAt) <= Date.parse(now)) reasons.push('owned-future-review-required');
    if (reasons.length) return result('no-advancement', [...new Set(reasons)], { currentLimit: current, activeLimitChanged: false });
    const a = input.authorization;
    const recorded = text(a?.reference) && a.limit === input.limit && a.proposedLimit === input.proposedLimit && a.policyVersion === rules.version;
    return result(recorded ? 'authorization-recorded-review-release-boundary' : 'recommend-one-step-review', [], {
      currentLimit: current, proposedLimit: input.proposedLimit, activeLimitChanged: false,
      authorizationRecorded: Boolean(recorded), nextGate: 'Existing owner independently verifies decision scope, exact candidate, consumer acceptance and applicable release authorization; no limit changes here.' });
  }
  if (!text(input.baselineModel) || !text(input.candidateModel) || input.baselineModel === input.candidateModel ||
      !Array.isArray(input.availableAuthorizedModels) || [input.baselineModel, input.candidateModel].some(id => !input.availableAuthorizedModels.some(m => m?.id === id && text(m.availabilityRef) && text(m.authorizationRef)))) reasons.push('current-authorized-model-access-required');
  let improved = false;
  const runIds = [];
  for (const row of rows) {
    reasons.push(...taskProblems(row.baseline, now), ...taskProblems(row.candidate, now));
    if (!row.baseline || !row.candidate) continue;
    const b = row.baseline, c = row.candidate; runIds.push(b.runId, c.runId);
    if (!text(row.inputSha256) || !/^[a-f0-9]{64}$/.test(row.inputSha256) || b.model !== input.baselineModel || c.model !== input.candidateModel ||
        b.taskId !== row.taskId || c.taskId !== row.taskId || b.inputSha256 !== row.inputSha256 || c.inputSha256 !== row.inputSha256 || b.policyVersion !== rules.version || c.policyVersion !== rules.version ||
        b.outcome !== c.outcome || b.quality?.criteriaRef !== c.quality?.criteriaRef || b.cost?.currency !== c.cost?.currency || b.usage?.unit !== c.usage?.unit) reasons.push('non-comparable-model-task');
    const before = [b.quality?.defects, Date.parse(b.completedAt) - Date.parse(b.startedAt), b.cost?.value, b.usage?.value, b.retries, b.humanInterventions];
    const after = [c.quality?.defects, Date.parse(c.completedAt) - Date.parse(c.startedAt), c.cost?.value, c.usage?.value, c.retries, c.humanInterventions];
    if (after.some((n, i) => n > before[i])) reasons.push('quality-time-cost-or-intervention-tradeoff');
    if (after.some((n, i) => n < before[i])) improved = true;
  }
  if (new Set(runIds).size !== runIds.length) reasons.push('duplicate-run-evidence');
  if (!improved) reasons.push('no-demonstrated-improvement');
  return result(reasons.length ? 'no-model-advancement' : 'recommend-model-review', [...new Set(reasons)], { configuredModelChange: false, nextGate: 'Existing owner reviews actual outputs and applicable model/configuration authority; no settings change here.' });
}
module.exports = { snapshot, optionalAdmission, reviewAdmission };
