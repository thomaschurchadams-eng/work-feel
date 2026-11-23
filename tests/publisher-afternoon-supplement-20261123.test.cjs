const { test } = require('node:test');
const assert = require('node:assert/strict');
const guards = require('../lib/daily-cycle-guards.cjs');
const planner = require('../lib/publisher-write-plan.cjs');
const rules = require('../automation/publishing-rules.json');
const fs = require('node:fs');

const approval = 'Sentinel_de3e44c4f080819180e75054f8ee1dfa';
const t0 = '2026-11-23T20:40:00Z';
const t1 = '2026-11-23T20:41:00Z';
const a = 'a'.repeat(40), b = 'b'.repeat(40), c = 'c'.repeat(40);
const url = 'https://creditunionainews.com/news/golden-1-california-hope-check-cashing.html';
const source = { candidateId:'golden-1-california-hope-check-cashing', eventKey:'golden-1-california-hope-check-cashing', sourceUrl:'https://www.cuinsight.com/press-release/californias-hope-program-opens-doors-to-financial-independence-for-vulnerable-youth-through-golden-1-partnership/', sourcePublishedAt:'2026-11-23' };
const exact = (provided = process.env.EXACT_MONDAY_BASE) => {
  if (provided) return JSON.parse(fs.readFileSync(provided,'utf8'));
  const current = { date:'2026-11-23', status:'held', outcomeSlot:2, fullArticleCount:1, alertCount:0, shortfall:{target:10,live:1}, publications:[],
    discoveryCoverage:{date:'2026-11-23',candidateCount:1,candidateInventory:[{candidateId:'insight',eventKey:'insight',sourceUrl:'https://example.org/insight',sourcePublishedAt:'2026-11-20'}]}, regularPublicationSlots:[] };
  const original = 'https://creditunionainews.com/insight-credit-union-ai-survey-evidence.html';
  current.publications.push({type:'article',url:original});
  const pending = {prNumber:421,head:'7f7806b775365b7dbaf8d0ec676a2161632e8964',run:45154683836,job:137624504451,runAttempt:1};
  current.regularPublicationSlots.push({slot:1,status:'live-verified',accountableOwner:'daily-publisher',url:original,verifiedAt:'2026-11-23T10:37:22Z',productionCommit:'4969fe37355b183d78bee45aa15bdf55a7a9aca5',evidence:{pending,terminalValidation:{...pending,observedAt:'2026-11-23T10:30:00Z',conclusion:'success'},terminalAcceptance:{...pending,visualReviewedAt:'2026-11-23T10:34:43Z'},articleSelection:current.discoveryCoverage.candidateInventory[0]}});
  for (let i=2;i<=10;i++) current.regularPublicationSlots.push({slot:i,status:'editorial-hold',accountableOwner:'daily-publisher',holdReason:'morning source pool exhausted',nextReviewAt:'2026-11-24T10:00:00Z'});
  return {current,history:[]};
};
function prepared(base, slot=2) {
  const next = structuredClone(base);
  const {alertCount,...morningSnapshot} = structuredClone(base.current);
  morningSnapshot.publications = morningSnapshot.publications.filter(p=>p.type==='article');
  next.current.afternoonSupplement = {approval,owner:'daily-publisher',closedMorningReceipt:'https://github.com/thomaschurchadams-eng/work-feel/issues/160#issuecomment-7098352141',openedAt:t0,morningSnapshot,candidateInventory:[source]};
  next.current.regularPublicationSlots[slot-1] = {slot,status:'prepared',accountableOwner:'daily-publisher',candidateTitle:'Golden 1 Expands Access to California HOPE Accounts',url,nextReviewAt:t1,evidence:{articleSelection:source,afternoonSupplement:{approval,preparedAt:t0}}};
  return next;
}
function review(state, now=t1, options={}) {
  return planner.validateArticleReview({mergeBase:{sha:a,stateBlob:a},review:{sha:b,stateBlob:a,files:[{path:url.split('.com/')[1],status:'added'}]},main:{sha:c,stateBlob:a,state,changedPaths:[]},rules,now,...options});
}

test('existing publisher admits prepared PR and exactly one evidence-bound live supplement without changing morning or Alerts',()=>{
  const base = exact(), p = prepared(base);
  const originalMorning = structuredClone(p.current.afternoonSupplement.morningSnapshot);
  guards.validateStatePreservation(base,p,rules);
  assert.equal(review(p).slot,2);
  const pending = structuredClone(p);
  const identity = { head:b, run:2, job:3, runAttempt:1, prNumber:427 };
  Object.assign(pending.current.regularPublicationSlots[1],{status:'pending-validation'});
  Object.assign(pending.current.regularPublicationSlots[1].evidence,{pending:identity});
  guards.validateStatePreservation(p,pending,rules);
  const validated = structuredClone(pending);
  const v=validated.current.regularPublicationSlots[1];v.status='validated';
  Object.assign(v.evidence,{terminalValidation:{...identity,observedAt:t1,conclusion:'success'},terminalAcceptance:{...identity,visualReviewedAt:t1}});
  guards.validateStatePreservation(pending,validated,rules);
  const plan = review(validated,t1,{phase:'release',prNumber:427,decision:{decision:'awaiting-visual-review',releaseReady:false,terminalEvidence:v.evidence.terminalValidation}});
  const mergeProof={slot:2,reviewHead:b,mergeCommit:a,prNumber:427,checkpoint:identity};
  const production={commit:a,state:'READY',url,articleVerified:true,imageVerified:true,listingVerified:true,homePlacementVerified:true,verifiedAt:'2026-11-23T20:42:00Z'};
  const close = planner.planLiveCloseout({base:validated,expectedMain:c,observedMain:c,rules,plan,mergeProof,production});
  assert.equal(close.candidate.current.fullArticleCount,2);
  assert.equal(close.candidate.current.status,'held');
  assert.equal(close.candidate.current.alertCount,base.current.alertCount);
  assert.deepEqual(close.candidate.current.afternoonSupplement.morningSnapshot,originalMorning);
  assert.deepEqual(close.candidate.history,base.history);
  assert.equal(planner.planLiveCloseout({base:close.candidate,expectedMain:c,observedMain:c,rules,plan,mergeProof,production}).kind,'already-recorded');
  assert.throws(()=>planner.planLiveCloseout({base:validated,expectedMain:c,observedMain:c,rules,plan,mergeProof,production:{...production,verifiedAt:'2026-11-24T05:00:00Z'}}),/outside the authorized release window/);
});
test('ordinary path, duplicate/parallel queue, expired review, forged approval and morning rewrite all fail closed',()=>{
  const base=exact();
  let p=prepared(base); delete p.current.afternoonSupplement;
  assert.throws(()=>guards.validateStatePreservation(base,p,rules),/requires its owned supplement record/);
  p=prepared(base,3);
  assert.throws(()=>guards.validateStatePreservation(base,p,rules),/earlier article slot/);
  p=prepared(base);
  assert.throws(()=>review(p,'2026-11-24T05:00:00Z'),/window has ended/);
  p.current.afternoonSupplement.approval='forged';
  assert.throws(()=>guards.validateStatePreservation(base,p,rules),/does not match/);
  p=prepared(base);p.current.afternoonSupplement.morningSnapshot.shortfall.live=8;
  assert.throws(()=>guards.validateStatePreservation(base,p,rules),/immutable 1-of-10/);
  p=prepared(base);p.current.shortfall={...p.current.shortfall,live:2};
  assert.throws(()=>guards.validateStatePreservation(base,p,rules),/rewrite the closed morning/);
  p=prepared(base);p.current.afternoonSupplement.candidateInventory.push({...source,candidateId:'alias',eventKey:'Golden 1 California HOPE check cashing'});
  assert.throws(()=>guards.validateStatePreservation(base,p,rules),/distinct append-only/);
});

test('ordinary scorer admission stays unchanged unless the explicit date-bound supplement inventory passes',()=>{
  const base=exact();
  const observed=guards.inspectAfternoonSourceInventory(base.current,[source],t0);
  assert.deepEqual(observed,{date:'2026-11-23',owner:'daily-publisher',approval,releaseReady:false});
  assert.equal(base.current.afternoonSupplement,undefined);
  const p=prepared(base);
  assert.equal(guards.inspectAfternoonSourceInventory(p.current,[source],t1).approval,approval);
  assert.throws(()=>guards.inspectAfternoonSourceInventory(p.current,[{...source,sourcePublishedAt:'2026-11-22'}],t1),/append-only source inventory/);
  assert.throws(()=>guards.inspectAfternoonSourceInventory(base.current,[source],'2026-11-24T05:00:00Z'),/window is not open/);
  assert.throws(()=>guards.inspectAfternoonSourceInventory({...base.current,date:'2026-11-24'},[source],t0),/window is not open/);
  assert.throws(()=>guards.inspectAfternoonSourceInventory({...base.current,fullArticleCount:2},[source],t0),/immutable 1-of-10/);
});
