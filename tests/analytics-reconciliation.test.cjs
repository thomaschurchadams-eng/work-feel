const test=require('node:test');
const assert=require('node:assert/strict');
const {range,reconcile}=require('../lib/analytics-reconciliation.cjs');
function report(propertyId='520110560',days=7){
 return {ok:true,propertyId,generatedAt:'2026-11-03T15:48:52.153Z',windows:{sevenDay:{days,events:[{eventName:'cai_banner_impression',eventCount:100},{eventName:'cai_banner_click',eventCount:4}],reportEvidence:{events:{metadata:{timeZone:'America/New_York'}}}}}};
}
function destination(rows=[],rowCount=rows.length){
 const d=report('538586591');d.windows.sevenDay.acquisition=rows;
 d.windows.sevenDay.reportEvidence.acquisition={rowCount};return d;
}
const campaign=(sessions=3)=>({sessionSource:'creditunionainews',sessionMedium:'site_banner',sessionCampaignName:'cai_current_readiness_sep2026',sessions});
const top50=()=>Array.from({length:50},(_,i)=>({sessionSource:'other-'+i,sessionMedium:'organic',sessionCampaignName:'other',sessions:100-i}));

test('P2 window: seven days matches producer six-days-ago through today',()=>{
 assert.deepEqual(range(report(),'sevenDay'),{start:'2026-10-28',end:'2026-11-03',timeZone:'America/New_York'});
});
test('P2 window: twenty-eight days includes today and twenty-seven preceding days',()=>{
 assert.deepEqual(range(report('520110560',28),'sevenDay'),{start:'2026-10-07',end:'2026-11-03',timeZone:'America/New_York'});
});
test('fallback uses the property-local date across UTC midnight and DST',()=>{
 const r=report();r.generatedAt='2026-11-03T01:00:00Z';assert.equal(range(r,'sevenDay').end,'2026-11-02');assert.equal(range(r,'sevenDay').start,'2026-10-27');
 for(const time of ['2026-11-01T05:30:00Z','2026-11-01T06:30:00Z']){r.generatedAt=time;assert.equal(range(r,'sevenDay').end,'2026-11-01');assert.equal(range(r,'sevenDay').start,'2026-10-26');}
});
test('explicit export dates override the producer-compatible fallback',()=>{
 const r=report();Object.assign(r.windows.sevenDay,{startDate:'2026-10-01',endDate:'2026-10-07'});assert.deepEqual(range(r,'sevenDay'),{start:'2026-10-01',end:'2026-10-07',timeZone:'America/New_York'});
});
test('correct explicit destination dates now join; yesterday-ended dates cannot pass as a match',()=>{
 const cuai=report(),cai=destination([campaign()]);Object.assign(cai.windows.sevenDay,{startDate:'2026-10-28',endDate:'2026-11-03'});assert.equal(reconcile({cuai,cai}).rawObserved.attributedDestinationSessions,3);
 Object.assign(cai.windows.sevenDay,{startDate:'2026-10-27',endDate:'2026-11-02'});const r=reconcile({cuai,cai,exclusionEvidence:{providerReportsVerified:true,sourceProperty:'520110560',destinationProperty:'538586591',reportReference:'TEST FIXTURE only',range:{start:'2026-10-27',end:'2026-11-02',timeZone:'America/New_York'}}});assert.equal(r.rawObserved.attributedDestinationSessions,null);assert.equal(r.externalDemand.eligibleForReview,false);
});
test('P2 completeness: top50/75 with no campaign is unknown, never observed zero',()=>{
 const r=reconcile({cuai:report(),cai:destination(top50(),75)});assert.equal(r.rawObserved.attributedDestinationSessions,null);assert.ok(r.gaps.some(g=>/acquisition.*(incomplete|coverage)/i.test(g)));
});
test('a matching row in a truncated export is not a complete campaign total',()=>{
 const rows=top50();rows[0]=campaign();const r=reconcile({cuai:report(),cai:destination(rows,75)});assert.equal(r.rawObserved.attributedDestinationSessions,null);
});
test('missing or inconsistent completeness metadata cannot imply zero',()=>{
 const d=destination([]);delete d.windows.sevenDay.reportEvidence.acquisition;assert.equal(reconcile({cuai:report(),cai:d}).rawObserved.attributedDestinationSessions,null);
 for(const rowCount of [-1,0,1.5,'1'])assert.equal(reconcile({cuai:report(),cai:destination([campaign()],rowCount)}).rawObserved.attributedDestinationSessions,null);
});
test('complete empty and complete top50 reports support real zero; complete matching export supports its total',()=>{
 for(const d of [destination([],0),destination(top50(),50)])assert.equal(reconcile({cuai:report(),cai:d}).rawObserved.attributedDestinationSessions,0);
 assert.equal(reconcile({cuai:report(),cai:destination([campaign()],1)}).rawObserved.attributedDestinationSessions,3);
});
test('exclusion flags cannot make an incomplete export eligible for external review',()=>{
 const cuai=report(),cai=destination(top50(),75),sourceRange=range(cuai,'sevenDay');const r=reconcile({cuai,cai,exclusionEvidence:{providerReportsVerified:true,sourceProperty:'520110560',destinationProperty:'538586591',reportReference:'TEST FIXTURE only',range:sourceRange}});assert.equal(r.externalDemand.eligibleForReview,false);assert.equal(r.externalDemand.destinationSessions,null);assert.equal(r.externalDemand.verified,false);
});
