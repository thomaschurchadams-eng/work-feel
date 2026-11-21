'use strict';
const test=require('node:test'), assert=require('node:assert/strict');
const fs=require('node:fs'), os=require('node:os'), path=require('node:path'), {spawnSync}=require('node:child_process');
const discovery=require('../lib/editorial-discovery.cjs'), registry=require('../automation/source-registry.json'), rules=require('../automation/publishing-rules.json');
const root=path.resolve(__dirname,'..'), date='2026-11-20';
const time='2026-11-20T12:00:00-05:00';
const receipt=(count=0)=>({date,candidateCount:count,beatsSearched:registry.beats.slice(0,6).map(x=>x.id),directions:discovery.DIRECTIONS.map(id=>({id,status:'searched',queryOrRead:'Isolated mock observation',observedAt:time,sourceUrls:['https://example.invalid/original']})),practicalSynthesis:{question:'Which operating problem is underserved?',noCandidateReason:'Fixture: source evidence insufficient'}});
const validate=(r,rows=[])=>discovery.validateDiscoveryReceipt(r,registry,rules,date,rows);
test('all five categories stay daily while query variants rotate inside each',()=>{
 for(let d=19;d<=25;d++){
  const plan=discovery.discoveryPlan(registry,rules,`2026-11-${d}`);
  assert.deepEqual(plan.directions.map(x=>x.id),discovery.DIRECTIONS);assert.equal(plan.candidateMaximum,d<22?12:30);assert.equal(plan.performedSearch,false);assert.equal(plan.releaseReady,false);
 }
 assert.notEqual(discovery.discoveryPlan(registry,rules,'2026-11-19').directions[0].selectedQuery,discovery.discoveryPlan(registry,rules,'2026-11-20').directions[0].selectedQuery);
 const wrong=structuredClone(registry);wrong.dailyDiscovery.directions.pop();assert.throws(()=>discovery.discoveryPlan(wrong,rules,date),/all-five/);
});
test('missing, duplicated and plan-only coverage cannot pass as an executed daily scan',()=>{
 assert.equal(validate(receipt()).completeCoverage,true);
 const missing=receipt();missing.directions.pop();assert.throws(()=>validate(missing),/five-direction/);
 const duplicate=receipt();duplicate.directions[4]=duplicate.directions[0];assert.throws(()=>validate(duplicate),/direction-observation/);
 assert.throws(()=>validate(discovery.discoveryPlan(registry,rules,date)),/twelve-candidate/);
 const stale=receipt();stale.date='2026-10-01';assert.throws(()=>validate(stale),/same-day/);
 const oldObservation=receipt();oldObservation.directions[0].observedAt='2026-10-01T12:00:00Z';assert.throws(()=>validate(oldObservation),/same-day-direction/);
 const blocked=receipt();blocked.directions[1]={...blocked.directions[1],status:'access-blocked',sourceUrls:[],reason:'Fixture denied source read; no retry'};
 const result=validate(blocked);assert.equal(result.completeCoverage,false);assert.deepEqual(result.accessBlocked,['function-problem']);assert.equal(result.releaseReady,false);
});
test('one twelve-candidate budget and practical synthesis selection are enforced',()=>{
 assert.throws(()=>validate(receipt(13),Array(13).fill({})),/twelve-candidate/);
 const noSynthesis=receipt();delete noSynthesis.practicalSynthesis;assert.throws(()=>validate(noSynthesis),/synthesis-selection/);
 const r=receipt(1);r.practicalSynthesis={question:'How should a CU evaluate review costs?',candidateId:'guide'};
 const c={id:'guide',section:'Insights',primarySourceUrls:['https://example.invalid/a','https://example.invalid/b']};assert.equal(validate(r,[c]).completeCoverage,true);
 assert.throws(()=>validate(r,[{...c,section:'News'}]),/synthesis-selection/);
 assert.throws(()=>validate(r,[{...c,primarySourceUrls:['https://example.invalid/a']}]),/synthesis-selection/);
});
test('the normal selector rejects missing receipt and over-budget input; optional choices require value evidence',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'cuai-discovery-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 for(const file of ['scripts/score-editorial-candidates.mjs','lib/editorial-discovery.cjs','lib/daily-cycle-guards.cjs','automation/publishing-rules.json','automation/source-registry.json','automation/editorial-taxonomy.json']){fs.mkdirSync(path.dirname(path.join(dir,file)),{recursive:true});fs.copyFileSync(path.join(root,file),path.join(dir,file));}
 const settings=structuredClone(rules);settings.standardCycle.optionalExtras.effectiveDate='2026-01-01';fs.writeFileSync(path.join(dir,'automation/publishing-rules.json'),JSON.stringify(settings));
 fs.writeFileSync(path.join(dir,'automation/coverage-ledger.json'),JSON.stringify({articles:[]}));
 const functions=require('../automation/editorial-taxonomy.json').functions;
 const rows=functions.slice(0,8).map((x,i)=>({id:'fixture-'+i,title:'Distinct topic '+i,functions:[x.id],technologies:['industry-development'],format:'analysis',sourceTier:1,sourceUrl:'https://example.invalid/source',confidence:1,newsworthiness:100,creditUnionRelevance:100,sourcePublishedAt:new Date().toISOString(),optionalSelection:{reason:'Independently supported operating need',distinctValue:'Useful separate problem and analysis',sourceUrls:['https://example.invalid/original']}}));
 fs.writeFileSync(path.join(dir,'frozen-clock.cjs'), "const NativeDate=Date; global.Date=class extends NativeDate {constructor(...args){super(...(args.length?args:['"+time+"']));}static now(){return NativeDate.parse('"+time+"');}};");
 const run=(values,proof)=>{fs.writeFileSync(path.join(dir,'candidates.json'),JSON.stringify(values));if(proof)fs.writeFileSync(path.join(dir,'receipt.json'),JSON.stringify(proof));return spawnSync(process.execPath,['--require','./frozen-clock.cjs','scripts/score-editorial-candidates.mjs','candidates.json',...(proof?['receipt.json']:[])],{cwd:dir,encoding:'utf8'});};
 assert.match(run(rows).stderr,/same-day discovery receipt required/);
 assert.match(run(Array(13).fill(rows[0]),receipt(13)).stderr,/twelve-candidate/);
 const seven=run(rows,receipt(8));assert.equal(seven.status,0,seven.stderr);const result=JSON.parse(seven.stdout);
 if(result.coreTarget){assert.equal(result.selected.length,7);assert.deepEqual(result.selected.slice(5).map(x=>x.selectionRole),['optional-extra','optional-extra']);}
 const onlyCore=run(rows.map(({optionalSelection,...c})=>c),receipt(8));assert.equal(onlyCore.status,0,onlyCore.stderr);assert.equal(JSON.parse(onlyCore.stdout).selected.length,result.coreTarget);
 const foreign=run([{...rows[0],discoveryDirection:'international-comparisons'}],receipt(1));assert.match(foreign.stdout,/international-jurisdiction-or-us-cu-implication-missing/);
});

test('prospective shortlist has 10 core plus 4 source-reviewable backups, continues despite concentration, and cannot overfill week',t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'cuai-morning-selector-'));
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  for(const file of ['scripts/score-editorial-candidates.mjs','lib/editorial-discovery.cjs','lib/daily-cycle-guards.cjs','automation/publishing-rules.json','automation/source-registry.json','automation/editorial-taxonomy.json']){
    fs.mkdirSync(path.dirname(path.join(dir,file)),{recursive:true});fs.copyFileSync(path.join(root,file),path.join(dir,file));
  }
  const now='2026-11-29T07:00:00-05:00', earlier='2026-11-28T09:00:00-05:00';
  const examples='Antarctica Bighorn Cherokee Denmark Ecuador Faraday Gibraltar Huron Illinois Jamaica Kalamazoo Labrador Minnesota Norwood Ontario Panama Quebec Raleigh Scotland Tasmania Uckfield Valencia Warsaw Xiamen Yarmouth Zaragoza Alberta Bavaria Calcutta Dijon'.split(' ');
  const items=examples.map((title,i)=>({id:'id-'+i, eventKey:'event-'+i, title, functions:['risk-compliance'], technologies:['generative-ai'], format:'reported-news',section:'News',discoveryDirection:discovery.DIRECTIONS[i%4],sourceTier:1,sourceUrl:'https://example.invalid/source/'+i,confidence:1,newsworthiness:100,creditUnionRelevance:100,sourcePublishedAt:earlier}));
  fs.writeFileSync(path.join(dir,'frozen-clock.cjs'), "const NativeDate=Date; global.Date=class extends NativeDate {constructor(...args){super(...(args.length?args:['"+now+"']));}static now(){return NativeDate.parse('"+now+"');}};");
  const write=(name,val)=>fs.writeFileSync(path.join(dir,name),JSON.stringify(val));
  const existing=n=>Array.from({length:n},(_,i)=>({title:'previous'+i,functions:['risk-compliance'],technologies:['generative-ai'],publishedAt:earlier}));
  const evidence=receipt(); evidence.date='2026-11-29'; evidence.directions.forEach(x=>x.observedAt=now);
  const run=(rows,prev=60,proof={})=>{
    write('candidate.json',rows);write('receipt.json',{...evidence,candidateCount:rows.length,...proof});write('automation/coverage-ledger.json',{articles:existing(prev)});
    write('automation/daily-cycle-state.json',{current:{date:'2026-11-29',regularPublicationSlots:[]},history:[{date:'2026-11-28',regularPublicationSlots:[{status:'live-verified',evidence:{articleSelection:{eventKey:'event-3'}}}]}]});
    return spawnSync(process.execPath,['--require','./frozen-clock.cjs','scripts/score-editorial-candidates.mjs','candidate.json','receipt.json'],{cwd:dir,encoding:'utf8'});
  };
  const rejected=items.slice(0,24).map(x=>({...x}));
  rejected[0].title=rejected[1].title;
  rejected[2].sourcePublishedAt='2026-11-20T08:00:00-05:00';
  rejected[4].sourcePublishedAt='2026-11-31T08:00:00-05:00';
  Object.assign(rejected[5],{section:'Insights',sourcePublishedAt:'2026-11-09',durableValue:'Distinct fictional operating decision',
    primarySourceUrls:['https://example.invalid/original/5','https://example.invalid/original/6']});
  const good=run(rejected);
  assert.equal(good.status,0,good.stderr);
  const result=JSON.parse(good.stdout);
  assert.equal(result.weekStart,'2026-11-23');
  assert.equal(result.weeklyMaximum,70);
  assert.equal(result.selected.length,10);
  assert.ok(result.selected.every(x=>x.selectionRole==='core'&&x.concentrationReview.editorialReviewRecommended));
  assert.equal(result.backupCandidates.length,4); assert.ok(result.backupCandidates.every(x=>x.primarySourceReadRequired));
  assert.equal(result.rejectedDistinctness.length,1);
  assert.ok(result.rejected.find(c=>c.id==='id-3').reasons.includes('duplicate-or-near-duplicate'));
  assert.ok(result.rejected.find(c=>c.id==='id-2').reasons.includes('invalid-or-stale-source-date'));
  assert.ok(result.rejected.find(c=>c.id==='id-4').reasons.includes('invalid-or-stale-source-date'));
  assert.ok(result.ranked.some(c=>c.id==='id-5' && !c.rejected));
  const limited=run(items,65);assert.equal(limited.status,0,limited.stderr);assert.equal(JSON.parse(limited.stdout).selected.length,5);
  assert.match(run([...items,{...items[0],id:'last',eventKey:'last'}]).stderr,/shared-candidate-budget/);
  assert.match(run(items.slice(0,20)).stderr,/candidate-shortfall-requires-reason/);
  assert.equal(run(items.slice(0,20),60,{candidateShortfallReason:'Only twenty distinct source-backed sightings.'}).status,0);
  const duplicate=items.slice();duplicate[0]={...duplicate[0],eventKey:duplicate[1].eventKey.toUpperCase()};
  assert.match(run(duplicate).stderr,/distinct-candidate-identities/);
});
