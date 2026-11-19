'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), { spawnSync } = require('node:child_process');
const admission = require('../lib/adaptive-admission.cjs');
const root = path.resolve(__dirname, '..'), now = '2026-11-19T17:00:00Z';
// All receipts below are isolated fixtures, not claims about real tasks/providers.
const sha = 'a'.repeat(40), artifact = 'b'.repeat(64);
function context(date = '2026-11-19', timestamp = now) {
  const rules = structuredClone(require('../automation/publishing-rules.json'));
  const growth = structuredClone(require('../automation/growth-strategy.json'));
  const slots = Array.from({ length: 5 }, (_, i) => ({slot:i+1,plannedDate:date,status:'live-verified',accountableOwner:'daily-publisher',url:'https://example.invalid/'+i,productionCommit:sha,verifiedAt:timestamp,evidence:{terminalValidation:{conclusion:'success'},terminalAcceptance:{visualReviewedAt:timestamp}}}));
  return { rules, growth, state:{current:{date,status:'in-progress',fullArticleCount:5,regularPublicationSlots:slots}} };
}
function evidence(c, timestamp = now) {
  return {snapshot:admission.snapshot(c),owner:'daily-publisher',observedAt:timestamp,reviewRef:'fixture:actual-review',incidents:[],resources:[{name:'existing-runtime',unit:'minutes',available:30,requiredPerItem:10,reference:'fixture:remaining-budget',requirementRef:'fixture:comparable-work',observedAt:timestamp,validUntil:new Date(Date.parse(timestamp)+3600000).toISOString()}]};
}
function task(id, model = 'baseline-fixture') {
  return {taskId:id,inputSha256:artifact,runId:'fixture-'+model+'-'+id,model,policyVersion:require('../automation/publishing-rules.json').version,evidenceRef:'fixture:receipt',outcome:'live-verified',startedAt:'2026-11-18T12:00:00Z',completedAt:'2026-11-18T12:02:00Z',usage:{value:20,unit:'tokens',reference:'fixture:usage'},cost:{value:1,currency:'USD',reference:'fixture:cost'},retries:0,humanInterventions:0,quality:{accepted:true,defects:0,reviewer:'independent-fixture',criteriaRef:'fixture:criteria',observations:'Fixture actual-output review fields, not a real review',artifactSha256:artifact,reviewRef:'fixture:quality'}};
}
function increase(c) {
  return {kind:'limit-increase',limit:'articles',proposedLimit:8,evidence:evidence(c),plan:{reference:'fixture:predeclared-plan',rationale:'Representative complete cycle and a legitimate qualified hold',taskIds:['cycle','hold']},runs:[task('cycle'),{...task('hold'),outcome:'qualified-hold',holdReason:'No independently qualified source'}],independentReviewRef:'fixture:independent',qualifiedDemandRef:'fixture:distinct-deferred',distinctQualifiedDeferred:1,previousChangeOutcomeRef:'fixture:observed-current-cap',rollback:'Restore previous prospective config, preserve history',reviewAt:'2026-11-20T17:00:00Z'};
}
test('optional admission uses actual core completion, current snapshot and resources without increasing limits',()=>{
  const c=context(), e=evidence(c), frozen=JSON.stringify(c);
  assert.equal(admission.optionalAdmission(c,e,now).optionalCapacity,2);
  e.resources[0].available=10;assert.equal(admission.optionalAdmission(c,e,now).optionalCapacity,1);
  e.resources[0].available=9;assert.equal(admission.optionalAdmission(c,e,now).optionalCapacity,0);
  assert.equal(JSON.stringify(c),frozen);
  assert.equal(admission.optionalAdmission(c,undefined,now).coreTargetUnchanged,5);
  assert.equal(admission.optionalAdmission(c,undefined,now).releaseReady,false);
});
test('closed, stale, pending, unverified or conflicting core evidence cannot admit extras',()=>{
  for(const mutate of [c=>c.state.current.status='completed',c=>c.state.current.date='2026-11-18',c=>c.state.current.regularPublicationSlots[4].status='pending-validation',c=>delete c.state.current.regularPublicationSlots[0].productionCommit,c=>c.state.current.regularPublicationSlots[4].slot=1,c=>c.state.current.fullArticleCount=4]){
    const c=context();mutate(c);assert.equal(admission.optionalAdmission(c,evidence(c),now).optionalCapacity,0);
  }
  const c=context(), e=evidence(c);c.growth.activeExperiments.push({id:'concurrent'});
  assert.ok(admission.optionalAdmission(c,e,now).reasons.includes('missing-or-stale-source-snapshot'));
});
test('serious incidents reduce optional work immediately; unknown/expired resources fail closed',()=>{
  const c=context(), e=evidence(c);e.incidents=[{scope:'article',severity:'serious',status:'open',reference:'fixture:source-failure'}];
  assert.equal(admission.optionalAdmission(c,e,now).decision,'stop-discretionary');
  for(const mutate of [e=>delete e.incidents,e=>e.resources[0].available=null,e=>e.resources[0].validUntil=now,e=>e.observedAt='2026-11-18T17:00:00Z',e=>e.owner='new-publisher',e=>e.incidents=[null],e=>e.resources=[null]]){
    const proof=evidence(c);mutate(proof);assert.equal(admission.optionalAdmission(c,proof,now).optionalCapacity,0);
  }
});
test('private experiment admission retains two active experiments, closed holds, ownership and action boundaries',()=>{
  const c=context();
  const p={kind:'experiment',id:'new-fixture',evidence:evidence(c),hypothesis:'Evidence-linked clearer opening',comparisonRef:'fixture:existing-output',measure:'Source comprehension',successCriterion:'Correct source boundaries after one read',stopCriterion:'Factual or accessibility regression',rollback:'Keep existing output',authorityRef:'fixture:existing-private-review',reviewAt:'2026-11-20T17:00:00Z',actions:['private-editorial-review']};
  assert.equal(admission.reviewAdmission(p,c,now).decision,'eligible-for-owner-admission');
  assert.equal(admission.reviewAdmission({...p,actions:['social-post']},c,now).decision,'not-admitted');
  assert.equal(admission.reviewAdmission({...p,id:c.growth.closedExperiments[0].id},c,now).decision,'not-admitted');
  for(const [action,scope] of [['private-model-comparison','model'],['private-editorial-review','article'],['private-workflow-test','model']]){
    const q=structuredClone(p);q.actions=[action];q.evidence.incidents=[{scope,severity:'serious',status:'open',reference:'fixture:matching-action-hold'}];
    assert.equal(admission.reviewAdmission(q,c,now).decision,'stop-discretionary');
  }
  c.growth.activeExperiments=[{id:'first'},{id:'second'}];p.evidence=evidence(c);assert.equal(admission.reviewAdmission(p,c,now).decision,'not-admitted');
  p.evidence.incidents=[{scope:'experiment',severity:'serious',status:'open',reference:'fixture:failure'}];assert.equal(admission.reviewAdmission(p,c,now).decision,'stop-discretionary');
});
test('future increases are one-step recommendations with complete actual evidence, never active capacity',()=>{
  const c=context(), p=increase(c), before=JSON.stringify(c);
  const r=admission.reviewAdmission(p,c,now);assert.equal(r.decision,'recommend-one-step-review');assert.equal(r.activeLimitChanged,false);assert.equal(r.releaseReady,false);
  p.authorization={reference:'fixture:decision',limit:'articles',proposedLimit:8,policyVersion:c.rules.version};
  assert.equal(admission.reviewAdmission(p,c,now).decision,'authorization-recorded-review-release-boundary');
  assert.equal(admission.reviewAdmission(p,c,now).authorityVerified,false);
  assert.equal(JSON.stringify(c),before);
  for(const mutate of [x=>x.proposedLimit=9,x=>x.runs[0].outcome='technical-failure',x=>delete x.runs[0].cost,x=>x.runs.pop(),x=>x.runs[1].runId=x.runs[0].runId,x=>x.runs[0].policyVersion--,x=>x.runs[0].completedAt='2027-01-01T00:00:00Z',x=>x.distinctQualifiedDeferred=0,x=>x.runs[0]=null,x=>x.plan.taskIds='xx']){
    const q=increase(c);mutate(q);assert.notEqual(admission.reviewAdmission(q,c,now).decision,'recommend-one-step-review');
  }
});
test('model recommendations compare real-task fields, quality, elapsed time, usage/cost, retries and human intervention',()=>{
  const c=context();const p={kind:'model-comparison',evidence:evidence(c),baselineModel:'baseline-fixture',candidateModel:'candidate-fixture',availableAuthorizedModels:['baseline-fixture','candidate-fixture'].map(id=>({id,availabilityRef:'fixture:available',authorizationRef:'fixture:authorized'})),plan:{reference:'fixture:paired-plan',rationale:'Two representative source and output tasks',taskIds:['source','output']},pairs:['source','output'].map(id=>({taskId:id,inputSha256:artifact,baseline:task(id),candidate:{...task(id,'candidate-fixture'),completedAt:'2026-11-18T12:01:00Z'}}))};
  assert.equal(admission.reviewAdmission(p,c,now).decision,'recommend-model-review');
  assert.equal(admission.reviewAdmission(p,c,now).configuredModelChange,false);
  for(const mutate of [x=>delete x.pairs[0].candidate.usage,x=>x.pairs[0].baseline.taskId='other',x=>x.pairs[0].candidate.taskId='other',x=>delete x.pairs[0].baseline.inputSha256,x=>x.pairs[0].candidate.inputSha256='c'.repeat(64),x=>delete x.pairs[0].baseline.policyVersion,x=>x.pairs[0].candidate.policyVersion=-999,x=>x.availableAuthorizedModels[0]=null,x=>x.pairs[0].candidate.cost.value=2,x=>x.pairs[0].candidate.retries=1,x=>x.pairs[0].candidate.humanInterventions=null,x=>x.pairs[0].candidate.quality.observations='',x=>x.availableAuthorizedModels.pop(),x=>x.pairs[0].candidate.quality.defects=1,x=>{x.pairs[0].candidate.outcome='qualified-hold';x.pairs[0].candidate.holdReason='Different completion';}]){
    const q=structuredClone(p);mutate(q);assert.equal(admission.reviewAdmission(q,c,now).decision,'no-model-advancement');
  }
});
test('normal CLI enforces admission; no optional validator or live write is needed',t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'cuai-admission-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  for(const f of ['scripts/score-editorial-candidates.mjs','lib/editorial-discovery.cjs','lib/adaptive-admission.cjs','automation/source-registry.json','automation/editorial-taxonomy.json']){fs.mkdirSync(path.dirname(path.join(dir,f)),{recursive:true});fs.copyFileSync(path.join(root,f),path.join(dir,f));}
  const timestamp=new Date().toISOString(),date=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York'}).format(new Date());
  const c=context(date,timestamp);c.rules.standardCycle.optionalExtras.effectiveDate='2026-01-01';
  const write=(f,d)=>fs.writeFileSync(path.join(dir,f),JSON.stringify(d));
  write('automation/publishing-rules.json',c.rules);write('automation/daily-cycle-state.json',c.state);write('automation/growth-strategy.json',c.growth);
  const taxonomy=require('../automation/editorial-taxonomy.json'),registry=require('../automation/source-registry.json');
  write('automation/coverage-ledger.json',{articles:taxonomy.functions.slice(0,5).map((x,i)=>({title:'Existing accepted result '+i,functions:[x.id],technologies:['industry-development'],publishedAt:timestamp}))});
  const rows=taxonomy.functions.slice(5,8).map((x,i)=>({id:'new-'+i,title:'Distinct supported extra '+i,sourceTier:1,sourceUrl:'https://example.invalid/source',sourcePublishedAt:timestamp,confidence:1,newsworthiness:100,creditUnionRelevance:100,functions:[x.id],technologies:['industry-development'],format:'analysis',optionalSelection:{reason:'Separate source-backed decision',distinctValue:'Different operating question',sourceUrls:['https://example.invalid/evidence']}}));
  write('candidates.json',rows);
  const receipt={date,candidateCount:rows.length,beatsSearched:registry.beats.slice(0,6).map(x=>x.id),directions:registry.dailyDiscovery.directions.map(x=>({id:x.id,status:'searched',queryOrRead:'Fixture only; no search',observedAt:timestamp,sourceUrls:['https://example.invalid/evidence']})),practicalSynthesis:{question:'Underserved operating question',noCandidateReason:'Fixture insufficient synthesis evidence'},operatingEvidence:evidence(c,timestamp)};
  const run=(args)=>{const r=spawnSync(process.execPath,['scripts/score-editorial-candidates.mjs',...args],{cwd:dir,encoding:'utf8'});assert.equal(r.status,0,r.stderr);return JSON.parse(r.stdout);};
  write('receipt.json',receipt);const before=run(['candidates.json','receipt.json']);
  if(before.coreTarget){assert.equal(before.selected.length,2);assert.equal(before.optionalAdmission.optionalCapacity,2);assert.ok(before.selected.every(x=>x.selectionRole==='optional-extra'));}
  receipt.operatingEvidence.resources[0].available=10;write('receipt.json',receipt);assert.ok(run(['candidates.json','receipt.json']).selected.length<=1);
  delete receipt.operatingEvidence;write('receipt.json',receipt);assert.equal(run(['candidates.json','receipt.json']).selected.length,0);
  const p=increase(c);p.evidence=evidence(c,timestamp);p.reviewAt=new Date(Date.now()+86400000).toISOString();write('review.json',p);
  assert.equal(run(['--review-admission','review.json']).decision,'recommend-one-step-review');
  assert.equal(run(['--plan',date]).admissionSnapshot,admission.snapshot(c));
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir,'automation/daily-cycle-state.json'))),c.state);
});

test('future article advancement waits for the currently approved optional limit to activate',()=>{
  const timestamp='2026-11-18T17:00:00Z',c=context('2026-11-18',timestamp),p=increase(c);p.evidence=evidence(c,timestamp);
  const r=admission.reviewAdmission(p,c,timestamp);
  assert.equal(r.decision,'no-advancement');assert.ok(r.reasons.includes('current-optional-limit-not-yet-active'));
});
test('malformed optional evidence cannot interrupt the ordinary five-core selector',t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'cuai-core-malformed-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  for(const f of ['scripts/score-editorial-candidates.mjs','lib/editorial-discovery.cjs','lib/adaptive-admission.cjs','automation/source-registry.json','automation/editorial-taxonomy.json']){fs.mkdirSync(path.dirname(path.join(dir,f)),{recursive:true});fs.copyFileSync(path.join(root,f),path.join(dir,f));}
  const timestamp=new Date().toISOString(),date=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York'}).format(new Date()),c=context(date,timestamp);
  c.state.current.fullArticleCount=0;c.state.current.regularPublicationSlots=[];
  // The selector uses actual time. Make the isolated fixture a five-core day even on weekends.
  for(const day of ['Saturday','Sunday'])c.rules.standardCycle.fullArticleTargetByWeekday[day]=5;
  const write=(f,d)=>fs.writeFileSync(path.join(dir,f),JSON.stringify(d));
  write('automation/publishing-rules.json',c.rules);write('automation/daily-cycle-state.json',c.state);write('automation/growth-strategy.json',c.growth);write('automation/coverage-ledger.json',{articles:[]});
  const taxonomy=require('../automation/editorial-taxonomy.json'),registry=require('../automation/source-registry.json');
  const rows=taxonomy.functions.slice(0,5).map((x,i)=>({id:'core-'+i,title:'Useful distinct core '+i,sourceTier:1,sourceUrl:'https://example.invalid/source',sourcePublishedAt:timestamp,confidence:1,newsworthiness:100,creditUnionRelevance:100,functions:[x.id],technologies:['industry-development'],format:'analysis'}));write('candidates.json',rows);
  const receipt={date,candidateCount:rows.length,beatsSearched:registry.beats.slice(0,6).map(x=>x.id),directions:registry.dailyDiscovery.directions.map(x=>({id:x.id,status:'searched',queryOrRead:'Isolated fixture; no search',observedAt:timestamp,sourceUrls:['https://example.invalid/source']})),practicalSynthesis:{question:'Distinct function decisions',noCandidateReason:'No supported synthesis in fixture'}};
  for(const field of ['incidents','resources']){
    receipt.operatingEvidence=evidence(c,timestamp);receipt.operatingEvidence[field]=[null];write('receipt.json',receipt);
    const r=spawnSync(process.execPath,['scripts/score-editorial-candidates.mjs','candidates.json','receipt.json'],{cwd:dir,encoding:'utf8'});
    assert.equal(r.status,0,r.stderr);const out=JSON.parse(r.stdout);assert.equal(out.selected.length,5);assert.equal(out.optionalAdmission.optionalCapacity,0);
  }
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir,'automation/daily-cycle-state.json'))),c.state);
});
