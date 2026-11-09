import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = file => JSON.parse(fs.readFileSync(path.join(root, 'automation', file), 'utf8'));
const zone = 'America/New_York';
const date = process.argv[2];
const at = Date.parse(date + 'T12:00:00Z');
if (!/^\d{4}-\d\d-\d\d$/.test(date ?? '') || !Number.isFinite(at) || new Date(at).toISOString().slice(0, 10) !== date) {
  console.error('Usage: node scripts/report-publisher-slots.mjs YYYY-MM-DD');
  process.exit(2);
}
const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: zone }).format(at);
const rules = read('publishing-rules.json');
const state = read('daily-cycle-state.json');
const coverage = read('coverage-ledger.json');
const intended = rules.standardCycle.fullArticleTargetByWeekday[weekday] ?? 0;
const daily = [state.current, ...state.history].find(entry => entry?.date === date);
const tracked = daily?.regularPublicationSlots ?? [];
const canonical = value => typeof value === 'string' ? new URL(value, 'https://creditunionainews.com').href : null;
const statuses = new Set(['live-verified', 'editorial-hold', 'approval-hold', 'technical-failure', 'pending-validation', 'late-validation', 'prepared', 'pre-validation-blocked']);
const liveCounts = new Map();
for (const fact of tracked.filter(entry => entry.status === 'live-verified' && entry.url)) {
  const url = canonical(fact.url);
  liveCounts.set(url, (liveCounts.get(url) ?? 0) + 1);
}
const slots = Array.from({ length: intended }, (_, index) => {
  const slot = index + 1;
  const fact = tracked.find(entry => entry.slot === slot);
  const publications = (daily?.publications ?? []).filter(entry => entry.type === 'article');
  const matched = fact?.url ? publications.find(entry => canonical(entry.url) === canonical(fact.url)) : !fact ? publications[index] : undefined;
  const ledger = matched && coverage.articles.find(entry => canonical(entry.url) === canonical(matched.url));
  const duplicateLive = fact?.status === 'live-verified' && liveCounts.get(canonical(fact.url)) > 1;
  const liveProof = !duplicateLive && fact?.status === 'live-verified' && fact.url && matched && ledger &&
    canonical(fact.url) === canonical(matched.url) && /(?:Z|[+-]\d\d:\d\d)$/.test(fact.verifiedAt ?? '') && Number.isFinite(Date.parse(fact.verifiedAt)) &&
    /^[a-f0-9]{40}$/.test(fact.productionCommit ?? '');
  let status = liveProof ? 'live-verified' : statuses.has(fact?.status) && fact.status !== 'live-verified' ? fact.status :
    matched ? 'recorded-publication-no-live-proof' : 'unclassified-no-slot-evidence';
  if (!liveProof && fact?.status === 'live-verified') status = 'recorded-publication-no-live-proof';
  if (duplicateLive) status = 'duplicate-live-publication';
  return {
    plannedDate: date, slot, timezone: zone, status,
    liveUrl: liveProof ? canonical(fact.url) : null,
    verifiedAt: liveProof ? fact.verifiedAt : null,
    liveProof: liveProof ? { productionCommit: fact.productionCommit, coverageId: ledger.id } : 'No verified live proof in slot record.',
    recordedPublicationUrl: matched ? canonical(matched.url) : null,
    coveragePublishedAt: ledger?.publishedAt ?? null,
    accountableOwner: 'daily-publisher',
    nextAction: fact?.nextAction ?? 'Reconcile this slot against production and issue #160; record evidence and the next check.',
    nextReviewAt: fact?.nextReviewAt ?? null,
    unfilledReason: liveProof ? null : fact?.holdReason ?? fact?.blocker?.reason ?? null,
    candidateTitle: fact?.candidateTitle ?? null,
    issueEvent: fact?.issueEvent ?? null,
    evidence: fact?.evidence ?? null
  };
});
console.log(JSON.stringify({ date, weekday, timezone: zone, intended, basis: 'Current prospective weekday targets; not retrospective obligations or permission to reopen closed cycles. No publication deadline inferred. Historical days may lack slot evidence.', slots }, null, 2));
