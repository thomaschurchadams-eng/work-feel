import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const read = (p) => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
const taxonomy = read('automation/editorial-taxonomy.json');
const ledger = read('automation/coverage-ledger.json');
const rules = read('automation/publishing-rules.json');
const inputPath = process.argv[2];

if (!inputPath) {
  console.error('Usage: node scripts/score-editorial-candidates.mjs candidates.json');
  process.exit(1);
}

const candidates = JSON.parse(fs.readFileSync(path.resolve(inputPath), 'utf8'));
if (!Array.isArray(candidates)) throw new Error('Candidate input must be a JSON array.');

const now = new Date();
const daysAgo = (date) => (now - new Date(date)) / 86400000;
const recent = ledger.articles.filter((a) => daysAgo(a.publishedAt) <= rules.selection.lookbackDays);
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
  const similarity=Math.max(0,...recent.map((a)=>jaccard(c.title,a.title)));
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
for(const candidate of scored.filter((c)=>!c.rejected)){
  const primaryFunction=candidate.functions[0], primaryTechnology=candidate.technologies[0];
  const fnCount=selected.filter((x)=>x.functions[0]===primaryFunction).length;
  const techCount=selected.filter((x)=>x.technologies[0]===primaryTechnology).length;
  if(fnCount>=rules.selection.maximumSamePrimaryFunctionPerWeek || techCount>=rules.selection.maximumSamePrimaryTechnologyPerWeek) continue;
  selected.push(candidate);
  if(selected.length>=rules.weeklyTargets.siteStoriesMax) break;
}

process.stdout.write(JSON.stringify({generatedAt:now.toISOString(),selected,rejected:scored.filter((c)=>c.rejected),ranked:scored},null,2)+'\n');
