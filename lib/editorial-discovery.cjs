'use strict';
// Pure planning/receipt checks, not a search executor or editorial approval.
const { morningArticleProfile, candidateInventoryKey } = require('./daily-cycle-guards.cjs');
const DIRECTIONS = ['regional-cu-leagues-regulators', 'function-problem', 'independent-data-research', 'international-comparisons', 'practical-synthesis'];
const nonempty = value => typeof value === 'string' && value.trim().length > 0;
const publicUrl = value => typeof value === 'string' && /^https:\/\/[^\s/@]+(?:\/[^\s]*)?$/.test(value);
function discoveryPlan(registry, rules, date) {
  if (!/^\d{4}-\d\d-\d\d$/.test(date || '') || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date) throw Error('invalid-discovery-date');
  const daily = registry.dailyDiscovery;
  const morning = morningArticleProfile(rules.standardCycle, date);
  if (daily?.categoryRotationAllowed !== false || daily.candidateMaximum !== rules.standardCycle.maximumCandidatesToEvaluate ||
      daily.directions?.length !== DIRECTIONS.length || DIRECTIONS.some(id => daily.directions.filter(x => x.id === id).length !== 1)) throw Error('all-five-daily-directions-required');
  const offset = Math.floor(Date.parse(date) / 86400000);
  return { date, candidateMaximum: morning?.candidateMaximum ?? daily.candidateMaximum,
    candidateTarget: morning?.candidateTarget ?? rules.standardCycle.minimumCandidatesToEvaluate,
    backupTarget: morning?.backupTarget ?? 0, minimumDistinctBeats: daily.minimumDistinctBeats,
    performedSearch: false, releaseReady: false,
    directions: DIRECTIONS.map(id => {
      const direction = daily.directions.find(x => x.id === id);
      if (!direction.queries?.length) throw Error('direction-query-missing');
      return { ...direction, selectedQuery: direction.queries[offset % direction.queries.length] };
    }) };
}
function validateDiscoveryReceipt(receipt, registry, rules, date, candidates) {
  const plan = discoveryPlan(registry, rules, date);
  if (receipt?.date !== date || !Array.isArray(receipt.directions) || receipt.directions.length !== DIRECTIONS.length) throw Error('same-day-five-direction-receipt-required');
  const morning = morningArticleProfile(rules.standardCycle, date);
  if (!Array.isArray(candidates) || candidates.length > plan.candidateMaximum || receipt.candidateCount !== candidates.length)
    throw Error(morning ? 'shared-candidate-budget-exceeded-or-mismatched' : 'shared-twelve-candidate-budget-exceeded-or-mismatched');
  if (morning && candidates.length < plan.candidateTarget && !nonempty(receipt.candidateShortfallReason))
    throw Error('bounded-candidate-shortfall-requires-reason');
  const inventory = morning ? candidates.map(c => ({candidateId:c?.id?.trim?.(),eventKey:c?.eventKey?.trim?.(),sourceUrl:typeof c?.sourceUrl==='string'?c.sourceUrl:null,sourcePublishedAt:typeof c?.sourcePublishedAt==='string'?c.sourcePublishedAt:null})) : null;
  if (morning && (inventory.some(row => !candidateInventoryKey(row)) ||
      new Set(inventory.map(row => row.candidateId)).size !== inventory.length ||
      new Set(inventory.map(row => JSON.parse(candidateInventoryKey(row))[1])).size !== inventory.length))
    throw Error('distinct-candidate-identities-and-event-keys-required');
  if (!Array.isArray(receipt.beatsSearched) || new Set(receipt.beatsSearched).size < plan.minimumDistinctBeats || receipt.beatsSearched.some(id => !registry.beats.some(b => b.id === id))) throw Error('six-known-beats-required');
  for (const id of DIRECTIONS) {
    const rows = receipt.directions.filter(x => x.id === id), row = rows[0];
    if (rows.length !== 1 || !['searched', 'access-blocked'].includes(row.status) || !nonempty(row.queryOrRead) ||
        !/(?:Z|[+-]\d\d:\d\d)$/.test(row.observedAt || '') || !Number.isFinite(Date.parse(row.observedAt))) throw Error('direction-observation-required:' + id);
    const observationDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date(row.observedAt));
    if (observationDate !== date) throw Error('same-day-direction-observation-required:' + id);
    if (row.status === 'access-blocked' ? !nonempty(row.reason) : !Array.isArray(row.sourceUrls) || !row.sourceUrls.length || !row.sourceUrls.every(publicUrl)) throw Error('direction-evidence-required:' + id);
  }
  const synthesis = receipt.practicalSynthesis;
  if (!nonempty(synthesis?.question) || !(nonempty(synthesis.noCandidateReason) || candidates.some(c => c.id === synthesis.candidateId && c.section === 'Insights' && Array.isArray(c.primarySourceUrls) && new Set(c.primarySourceUrls).size >= 2 && c.primarySourceUrls.every(publicUrl)))) throw Error('practical-synthesis-selection-required');
  return { verifiedStructure: true, completeCoverage: receipt.directions.every(x => x.status === 'searched'),
    accessBlocked: receipt.directions.filter(x => x.status === 'access-blocked').map(x => x.id),
    ...(morning ? { date, candidateCount: inventory.length, candidateInventory: inventory, candidateTarget: plan.candidateTarget, candidateShortfallReason: candidates.length < plan.candidateTarget ? receipt.candidateShortfallReason : null } : {}),
    releaseReady: false };
}
function optionalExtraEligible(candidate) {
  const evidence = candidate.optionalSelection;
  return nonempty(evidence?.reason) && nonempty(evidence?.distinctValue) && Array.isArray(evidence?.sourceUrls) && evidence.sourceUrls.length > 0 && evidence.sourceUrls.every(publicUrl);
}
module.exports = { DIRECTIONS, discoveryPlan, validateDiscoveryReceipt, optionalExtraEligible };
