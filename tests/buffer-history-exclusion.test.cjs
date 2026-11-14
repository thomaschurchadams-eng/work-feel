const test=require('node:test'), assert=require('node:assert/strict');
const {excludeHistoricalSent:check,idDigest,sha256}=require('../lib/buffer-history-exclusion.cjs');
const policy=require('../automation/media-policy.json');
const now=Date.parse('2026-11-14T00:30:00Z'),head='a'.repeat(40),html='<article>fixture Q3 results</article>';
function fixture(){
 const proof=structuredClone(policy.distribution.reviewedEventExclusions[0]);
 proof.articleSha256=sha256(html);
 const records=Array.from({length:78},(_,i)=>({id:'fixture-'+i,status:'sent',channelId:policy.distribution.channelId,sentAt:i===77?proof.history.latestSentAt:'2026-10-01T12:00:00Z',dueAt:null,canonicalUrls:[],requiresReview:true}));
 proof.history.idSetSha256=idDigest(records);
 const distribution=new URL(proof.canonicalUrl);distribution.search=new URLSearchParams({utm_source:'linkedin',utm_medium:'organic_social',utm_campaign:'cuai_news',utm_content:proof.candidateId});
 const item={id:proof.candidateId,platform:'linkedin',status:'queued',contentKind:'article',eventId:proof.eventId,parentPublicationId:proof.parentPublicationId,articleUrl:proof.canonicalUrl,distributionUrl:distribution.toString(),copy:proof.copyLead+' '+distribution};
 return {proofs:[proof],item,queue:[item],articleHtml:html,commitSha:head,now,inventory:{complete:true,requiresReview:true,error:null,startedAt:new Date(now-1000).toISOString(),observedAt:new Date(now-500).toISOString(),channelId:policy.distribution.channelId,channelQueuePaused:false,commitSha:head,recordCount:78,records}};
}
test('exact reviewed new event excludes only its frozen sent set without altering any flag or input',()=>{
 const f=fixture(),before=JSON.stringify(f);assert.equal(check(f).ok,true);assert.equal(JSON.stringify(f),before);assert.equal(f.inventory.requiresReview,true);assert.equal(f.inventory.records.filter(p=>p.requiresReview).length,78);
});
test('rename, syndication, reused slug/body, changed copy, parent and arbitrary article cannot inherit approval',()=>{
 for(const change of [{id:'different'},{articleUrl:'https://creditunionainews.com/news/renamed.html'},{parentPublicationId:'older-parent'},{eventId:'old-announcement'},{copy:'New title for an old event'},{distributionUrl:'https://example.org/'}]){const f=fixture();Object.assign(f.item,change);assert.ok(check(f).error);}
 const f=fixture();f.articleHtml='<article>Reused slug, different event</article>';assert.equal(check(f).error,'historical_exclusion_candidate_mismatch');
 for(const change of [{eventId:f.item.eventId},{parentPublicationId:f.item.parentPublicationId},{articleUrl:f.item.articleUrl}]){const f=fixture();f.queue.push({id:'prior',...change});assert.equal(check(f).error,'linkedin_publication_duplicate');}
});
test('existing destination, including a record that also has opaque links, is never excluded',()=>{
 const f=fixture();f.inventory.records[0].canonicalUrls=[f.item.articleUrl];assert.equal(check(f).error,'linkedin_provider_destination_duplicate');
});
test('all unknown or known active states and newly added/missing/changed records hold',()=>{
 for(const status of ['draft','scheduled','sending','error','needs_approval']){const f=fixture();f.inventory.records[0].status=status;assert.equal(check(f).error,'historical_exclusion_snapshot_changed');}
 for(const alter of [r=>r.pop(),r=>r.push({...r[0],id:'new'}),r=>r[0].id='replacement',r=>r[0].sentAt='2026-11-04T00:00:00Z',r=>r[77].sentAt='2026-11-02T17:31:20Z',r=>r[0].id=r[1].id,r=>r[0].channelId='foreign']){const f=fixture();alter(f.inventory.records);f.inventory.recordCount=f.inventory.records.length;assert.equal(check(f).error,'historical_exclusion_snapshot_changed');}
});
test('fresh full exact-head/channel observation is mandatory; malformed and future times fail closed',()=>{
 for(const change of [{complete:false},{error:'timeout'},{recordCount:77},{channelQueuePaused:true},{channelQueuePaused:null},{commitSha:'b'.repeat(40)},{channelId:'foreign'},{startedAt:new Date(now-60001).toISOString()},{observedAt:new Date(now+1).toISOString()},{startedAt:'bad'},{observedAt:'bad'},{startedAt:new Date(now).toISOString()}]){const f=fixture();Object.assign(f.inventory,change);assert.equal(check(f).error,'historical_exclusion_inventory_invalid');}
});
test('timing inference cannot be reused before the event, without review or after expiry',()=>{
 for(const change of [{reviewedEventBoundary:'2026-11-01T00:00:00Z'},{reviewedAt:new Date(now+1).toISOString()},{expiresAt:new Date(now-1).toISOString()},{expiresAt:'2027-01-01T00:00:00Z'},{status:'pending'},{sourceUrls:[]},{articleSha256:'bad'}]){const f=fixture();Object.assign(f.proofs[0],change);assert.equal(check(f).error,'historical_exclusion_proof_invalid');}
});
test('review catalog contains one exact event, no general host/age exemption and no raw historical identifiers',()=>{
 const p=policy.distribution.reviewedEventExclusions;assert.equal(p.length,1);assert.equal(p[0].history.recordCount,78);assert.match(p[0].history.idSetSha256,/^[a-f0-9]{64}$/);assert.equal(p[0].canonicalUrl.includes('american-heritage'),false);
 const fs=require('node:fs');assert.equal(sha256(fs.readFileSync('news/heloc-balances-third-quarter-2026-credit-unions.html')),p[0].articleSha256);
});
module.exports={fixture};
