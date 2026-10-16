const test=require('node:test');
const assert=require('node:assert/strict');
const {gitRefCheckpointStore}=require('../automation/recovery/git-ref-checkpoint-store.cjs');
function connector({lostOnce=false}={}) {
 let revision=1,document={leases:{},states:{},appliedTransactions:[]},lost=lostOnce;
 return {
  read:async()=>({sha:String(revision),document:structuredClone(document)}),
  cas:async(expected,next)=>{
   if(expected!==String(revision))throw Object.assign(Error('stale_ref'),{code:'STALE_REF'});
   revision++;document=structuredClone(next);
   if(lost){lost=false;throw Object.assign(Error('response_lost'),{code:'OUTCOME_UNKNOWN'});}
  },
  snapshot:()=>({revision,document})
 };
}
test('unverified connector cannot activate checkpoint store',()=>assert.throws(()=>gitRefCheckpointStore({read:async()=>{},cas:async()=>{},executionId:'test-run-0',ownerLive:async()=>false}),/checkpoint_cas_unverified/));
test('atomic connector serializes competing owners for one incident',async()=>{
 const c=connector(),options={...c,casVerified:true,ownerLive:async()=>true};
 const a=gitRefCheckpointStore({...options,executionId:'test-run-a'}),b=gitRefCheckpointStore({...options,executionId:'test-run-b'});
 const result=await Promise.allSettled([a.acquire('incident'),b.acquire('incident')]);
 assert.equal(result.filter(x=>x.status==='fulfilled').length,1);
 assert.equal(result.filter(x=>x.status==='rejected').length,1);
 await result.find(x=>x.status==='fulfilled').value();
 assert.equal(Object.keys(c.snapshot().document.leases).length,0);
});
test('lost successful CAS response is reconciled without replay',async()=>{
 const c=connector({lostOnce:true}),store=gitRefCheckpointStore({...c,casVerified:true,executionId:'test-run-lost',ownerLive:async()=>true});
 const release=await store.acquire('incident');
 await store.save({key:'incident',status:'working',steps:{},attempts:0});
 assert.equal((await store.load('incident')).status,'working');
 await release();
 assert.equal(Object.keys(c.snapshot().document.leases).length,0);
});
test('lease is not reclaimed on time alone; verified dead owner may be replaced',async()=>{
 const c=connector(),live=gitRefCheckpointStore({...c,casVerified:true,executionId:'test-run-live',ownerLive:async()=>true});
 await live.acquire('incident');
 const waiting=gitRefCheckpointStore({...c,casVerified:true,executionId:'test-run-next',ownerLive:async()=>true});
 await assert.rejects(waiting.acquire('incident'),/recovery_lease_busy/);
 const afterDeath=gitRefCheckpointStore({...c,casVerified:true,executionId:'test-run-next',ownerLive:async()=>({stopped:true,evidence:'terminal run receipt'})});
 const release=await afterDeath.acquire('incident');await release();
});
