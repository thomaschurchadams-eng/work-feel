import fs from 'node:fs';
import cadence from '../lib/daily-cycle-guards.cjs';
import path from 'node:path';
import discovery from '../lib/editorial-discovery.cjs';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const read = (p) => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
const taxonomy = read('automation/editorial-taxonomy.json');
const ledger = read('automation/coverage-ledger.json');
const rules = read('automation/publishing-rules.json');
const registry = read('automation/source-registry.json');
const inputPath = process.argv[2];

if (inputPath === '--plan') {
  console.log(JSON.stringify(discovery.discoveryPlan(registry, rules, process.argv[3]), null, 2));
  process.exit(0);
}

if (!inputPath) {
  console.error('Usage: node scripts/score-editorial-candidates.mjs candidates.json discovery-receipt.json [--nov23-afternoon-supplement] | --plan YYYY-MM-DD');
  process.exit(1);
}

const candidates = JSON.parse(fs.readFileSync(path.resolve(inputPath), 'utf8'));
if (!Array.isArray(candidates)) throw new Error('Candidate input must be a JSON array.');

const now = new Date();
const easternDate = date => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(date));
const today = easternDate(now);
if (!process.argv[3]) throw Error('same-day discovery receipt required; a plan is not an executed scan');
const discoveryReceipt = JSON.parse(fs.readFileSync(path.resolve(process.argv[3]), 'utf8'));
const discoveryCoverage = discovery.validateDiscoveryReceipt(discoveryReceipt, registry, rules, today, candidates);
const weekStart = cadence.articleWeekStart(today);
const morning = cadence.morningArticleProfile(rules.standardCycle, today);
const weeklyMaximum = morning?.weeklyMaximum ?? rules.weeklyTargets.siteStoriesMax;
const normalize = value => typeof value === 'string' ? value.trim().toLowerCase().replace(/[^a-z0-9]+/g,' ').trim() : '';
const isPublicHttps = value => typeof value === 'string' && /^https:\/\/[^\s/@]+(?:\/[^\s]*)?$/.test(value);
const week = ledger.articles.filter(a => Number.isFinite(Date.parse(a.publishedAt)) && new Date(a.publishedAt) <= now && easternDate(a.publishedAt) >= weekStart);
const alreadyPublishedToday = week.filter(a => easternDate(a.publishedAt) === today).length;
const daysAgo = (date) => (now - new Date(date)) / 86400000;
const recent = ledger.articles.filter((a) => daysAgo(a.publishedAt) <= rules.selection.lookbackDays);
const state = morning ? read('automation/daily-cycle-state.json') : null;
const mode = process.argv[4];
if (mode !== undefined && mode !== '--nov23-afternoon-supplement') throw Error('unrecognized-scoring-mode');
const afternoon = mode ? cadence.inspectAfternoonSourceInventory(state?.current, discoveryCoverage.candidateInventory, now.toISOString()) : null;
const lockedInventory = state?.current?.date === today ? state.current.discoveryCoverage?.candidateInventory : null;
if (lockedInventory && !afternoon) {
  const keys = rows=>rows.map(row=>JSON.stringify([cadence.candidateInventoryKey(row),row.sourceUrl,row.sourcePublishedAt])).sort();
  if (JSON.stringify(keys(lockedInventory)) !== JSON.stringify(keys(discoveryCoverage.candidateInventory)))
    throw Error('same-morning-candidate-inventory-must-be-reused');
}
const lookback = new Date(now.getTime() - rules.selection.lookbackDays * 86400000);
const recentPublishedEvents = new Set(state ? [state.current,...state.history]
  .filter(day => day.date >= easternDate(lookback) && day.date <= today)
  .flatMap(day => (day.regularPublicationSlots || []).filter(slot=>slot.status==='live-verified').map(slot=>normalize(slot.evidence?.articleSelection?.eventKey)))
  .filter(Boolean) : []);
const tokens = (text='') => new Set(text.toLowerCase().replace(/[^a-z0-9 ]/g,' ').split(/\s+/).filter((x)=>x.length>3));
const jaccard = (a,b) => {
  const A=tokens(a), B=tokens(b), intersection=[...A].filter((x)=>B.has(x)).length;
  return intersection / Math.max(1, new Set([...A,...B]).size);
};
const countRecent = (field,id) => recent.filter((a)=>(a[field]||[]).includes(id)).length;
const targetFor = (fn) => taxonomy.functions.find((x)=>x.id===fn)?.targetShare ?? (1/taxonomy.functions.length);
const coverageGap = (c) => {
  const fn = c.functions?.[0];
  const expected = targetFor(fn) * Math.max(recent.length, taxonomy.functions.length);
  const actual = countRecent('functions',fn);
  const functionGap = Math.max(0, Math.min(1,(expected-actual+1)/(expected+1)));
  const pairCount = recent.filter((a)=>(a.functions||[]).includes(fn) && (a.technologies||[]).includes(c.technologies?.[0])).length;
  return 100 * (0.65*functionGap + 0.35*(pairCount===0?1:1/(pairCount+1)));
};
const sourceQuality = (tier) => ({1:100,2:85,3:65,4:35}[tier] ?? 0);
const urgency = (publishedAt) => Math.max(0,100-daysAgo(publishedAt)*12.5);

function validate(c) {
  const reasons=[];
  if (!/^https:\/\//.test(c.sourceUrl||'')) reasons.push('missing-public-source-url');
  if (!Number.isInteger(c.sourceTier)||c.sourceTier>2) reasons.push('source-tier-below-2');
  if ((c.confidence??0)<0.7) reasons.push('confidence-below-0.7');
  if (!c.functions?.length||!c.technologies?.length||!c.format) reasons.push('missing-taxonomy-fields');
  if (morning) {
    if (!normalize(c.title) || !isPublicHttps(c.sourceUrl)) reasons.push('missing-title-or-public-source');
    if (!taxonomy.functions.some(x=>x.id===c.functions?.[0]) || !taxonomy.technologies.some(x=>x.id===c.technologies?.[0]) ||
        !taxonomy.formats.includes(c.format)) reasons.push('unknown-primary-taxonomy');
    if (!discovery.DIRECTIONS.includes(c.discoveryDirection)) reasons.push('missing-discovery-direction');
    if (!['News','Insights'].includes(c.section)) reasons.push('missing-editorial-section');
    const published = cadence.sourceTimestamp(c.sourcePublishedAt);
    if (!Number.isFinite(published) || published > now.getTime() ||
        (c.section === 'News' && now.getTime()-published > rules.standardCycle.candidateLookbackHours*3600000))
      reasons.push('invalid-or-stale-source-date');
    if (c.section === 'Insights' && Number.isFinite(published) &&
        now.getTime()-published > rules.standardCycle.candidateLookbackHours*3600000 &&
        (typeof c.durableValue !== 'string' || !c.durableValue.trim() || !Array.isArray(c.primarySourceUrls) ||
         new Set(c.primarySourceUrls).size < 2 || !c.primarySourceUrls.every(isPublicHttps)))
      reasons.push('durable-fallback-requires-evidence');
    if (!Number.isFinite(c.confidence) || c.confidence > 1 || c.sourceTier < 1 ||
        ![c.newsworthiness,c.creditUnionRelevance].every(x=>Number.isFinite(x) && x>=0 && x<=100))
      reasons.push('invalid-source-evidence');
    if (recentPublishedEvents.has(normalize(c.eventKey)) || recent.some(a => (c.eventKey && normalize(a.eventKey) === normalize(c.eventKey)) ||
        (normalize(c.title) && normalize(a.title) === normalize(c.title))))
      reasons.push('duplicate-or-near-duplicate');
  }
  if (c.discoveryDirection === 'international-comparisons' && (!c.sourceJurisdiction?.trim() || !c.usCreditUnionImplication?.trim())) reasons.push('international-jurisdiction-or-us-cu-implication-missing');
  if (c.discoveryDirection === 'practical-synthesis' && (c.section !== 'Insights' || !Array.isArray(c.primarySourceUrls) || new Set(c.primarySourceUrls).size < 2)) reasons.push('synthesis-requires-multiple-primary-sources-and-insights');
  const similarity=Math.max(0,...recent.map((a)=>jaccard(c.title||'',a.title||'')));
  if (similarity>=0.72) reasons.push('duplicate-or-near-duplicate');
  return {reasons,similarity};
}

const scored=candidates.map((candidate)=>{
  const {reasons,similarity}=validate(candidate);
  const metrics={
    newsworthiness:candidate.newsworthiness??0,
    creditUnionRelevance:candidate.creditUnionRelevance??0,
    coverageGap:coverageGap(candidate),
    originality:Math.round((1-similarity)*100),
    sourceQuality:sourceQuality(candidate.sourceTier),
    urgency:urgency(candidate.sourcePublishedAt)
  };
  const score=Object.entries(rules.weights).reduce((sum,[key,weight])=>sum+(metrics[key]??0)*weight,0);
  if(score<rules.selection.minimumScore) reasons.push('score-below-minimum');
  return {...candidate,score:Math.round(score*10)/10,metrics,rejected:reasons.length>0,reasons};
}).sort((a,b)=>b.score-a.score);

const selected=[];
const coreTarget = cadence.articleDayTarget(rules.standardCycle, today);
const dailyMaximum = cadence.articleDayMaximum(rules.standardCycle, today);
const available = scored.filter(c=>!c.rejected);
const preferenceReasons = (c, chosen) => {
  const fn = [...week,...chosen].filter(x=>x.functions?.[0]===c.functions[0]).length;
  const tech = [...week,...chosen].filter(x=>x.technologies?.[0]===c.technologies[0]).length;
  return [
    ...(fn >= (morning?.preferredMaximumPerPrimaryFunctionPerWeek ?? rules.selection.maximumSamePrimaryFunctionPerWeek) ? ['primary-function'] : []),
    ...(c.technologies[0] !== 'industry-development' &&
      tech >= (morning?.preferredMaximumPerActualTechnologyPerWeek ?? rules.selection.maximumSamePrimaryTechnologyPerWeek) ? ['actual-technology'] : []),
  ];
};
const duplicate = (a,b)=>normalize(a.title)===normalize(b.title) || normalize(a.eventKey)===normalize(b.eventKey) || jaccard(a.title,b.title)>=0.72;
const rejectedDistinctness = [];
if (morning) {
  // Once one distinct event is kept, do not let another candidate with the same
  // headline/near-match become a backup. Still verify event identity as editor.
  const distinct=[];
  for (const c of available) {
    if (distinct.some(other=>duplicate(c,other))) {
      c.rejected=true; c.reasons.push('duplicate-or-near-duplicate-within-pool');
      rejectedDistinctness.push(c.id);
    } else distinct.push(c);
  }
  // Prefer diversity within five points of the best candidate. Do not veto a
  // justified concentration or lower the sourcing, similarity or score gates.
  while (distinct.length && alreadyPublishedToday + selected.length < dailyMaximum && week.length + selected.length < weeklyMaximum) {
    const best = distinct[0];
    const bestBroadIndex = distinct.findIndex(c=>c.score >= best.score-5 && preferenceReasons(c,selected).length===0);
    const [c] = distinct.splice(bestBroadIndex < 0 ? 0 : bestBroadIndex,1);
    const concentration = preferenceReasons(c,selected);
    selected.push({...c, selectionRole:'core', ...(concentration.length ?
      { concentrationReview: { considerations: concentration, editorialReviewRecommended: true } } : {}) });
  }
  const backupCandidates=distinct.slice(0,morning.backupTarget).map(c=>({
    ...c, selectionRole:'backup', primarySourceReadRequired:true
  }));
  process.stdout.write(JSON.stringify({generatedAt:now.toISOString(),weekStart,weeklyMaximum,alreadyPublishedThisWeek:week.length,alreadyPublishedToday,
    coreTarget,dailyMaximum,discoveryCoverage,releaseReady:false,...(afternoon ? {afternoon} : {}),selected,backupCandidates,
    backupTarget:morning.backupTarget,backupShortfall:Math.max(0,morning.backupTarget-backupCandidates.length),
    rejectedDistinctness,rejected:scored.filter(c=>c.rejected),ranked:scored},null,2)+'\n');
} else {
  for(const candidate of available){
    if(alreadyPublishedToday + selected.length >= dailyMaximum || week.length + selected.length >= weeklyMaximum) break;
    if(preferenceReasons(candidate,selected).length) continue;
    if (alreadyPublishedToday + selected.length >= coreTarget && !discovery.optionalExtraEligible(candidate)) continue;
    selected.push({...candidate, selectionRole: alreadyPublishedToday + selected.length < coreTarget ? 'core' : 'optional-extra'});
  }
  process.stdout.write(JSON.stringify({generatedAt:now.toISOString(),weekStart,alreadyPublishedThisWeek:week.length,alreadyPublishedToday,coreTarget,dailyMaximum,discoveryCoverage,releaseReady:false,selected,rejected:scored.filter((c)=>c.rejected),ranked:scored},null,2)+'\n');
}
