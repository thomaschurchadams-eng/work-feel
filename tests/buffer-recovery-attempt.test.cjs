const test=require('node:test'),assert=require('node:assert/strict');
const {firstRecoveryAttempt:check}=require('../lib/buffer-recovery-attempt.cjs');
function fixture(){return{item:{id:'candidate',eventId:'new-event',parentPublicationId:'parent',articleUrl:'https://creditunionainews.com/new'},proofs:[{candidateId:'candidate',eventId:'new-event',parentPublicationId:'parent',canonicalUrl:'https://creditunionainews.com/new'}],eventName:'push',runAttempt:'1',before:'a'.repeat(40),after:'b'.repeat(40),head:'b'.repeat(40),readQueueBefore:async()=>({items:[{id:'old',eventId:'old-event',articleUrl:'https://creditunionainews.com/old'}]})};}
test('only original reservation push can attempt recovery; later pushes and reruns cannot retry even if receipt write failed',async()=>{
 assert.equal((await check(fixture())).ok,true);
 for(const change of [{eventName:'schedule'},{eventName:'workflow_dispatch'},{runAttempt:'2'},{before:'0'.repeat(40)},{after:'c'.repeat(40)},{before:'bad'}])assert.ok((await check({...fixture(),...change})).error);
 for(const prior of [{id:'candidate'},{id:'other',eventId:'new-event'},{id:'other',parentPublicationId:'parent'},{id:'other',articleUrl:'https://creditunionainews.com/new'},{id:'other',articleUrl:'https://creditunionainews.com/new?utm_source=linkedin'}])assert.equal((await check({...fixture(),readQueueBefore:async()=>({items:[{articleUrl:'https://creditunionainews.com/old',...prior}]})})).error,'recovery_attempt_requires_reconciliation');
});
test('prior queue errors/missing evidence hold; ordinary unrelated reservations retain existing behavior',async()=>{
 for(const readQueueBefore of [async()=>{throw Error('fixture secret')},async()=>({}),async()=>({items:null})])assert.equal((await check({...fixture(),readQueueBefore})).error,'recovery_attempt_prior_queue_unverified');
 assert.equal((await check({...fixture(),proofs:[],readQueueBefore:async()=>{throw Error('must not read')}})).ok,true);
});

test('malformed prior records cannot establish absence of an earlier attempt',async()=>{
 for(const row of [{},42,'unparseable',null,{id:'old',articleUrl:'garbled'},{id:'old',articleUrl:'https://creditunionainews.com/old',eventId:42}])assert.equal((await check({...fixture(),readQueueBefore:async()=>({items:[row]})})).error,'recovery_attempt_prior_queue_unverified');
 for(const change of [{eventId:undefined},{parentPublicationId:'different'},{articleUrl:'https://creditunionainews.com/reused'}])assert.equal((await check({...fixture(),item:{...fixture().item,...change}})).error,'recovery_attempt_candidate_mismatch');
});
