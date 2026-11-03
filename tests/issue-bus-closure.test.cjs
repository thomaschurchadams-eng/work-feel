'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {issueBusClosure}=require('../automation/recovery/issue-bus-closure.cjs');
const {recover}=require('../automation/recovery/checkpointed-recovery.cjs');
const captured=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/recovery/issue160-oct12.json'),'utf8'));
function closure(comments=captured.comments) {
  return issueBusClosure({repository:captured.repository,issueNumber:captured.issueNumber,
    runId:captured.operation.runId,deploymentSha:captured.operation.deploymentSha,
    readComments:async()=>comments});
}
test('captured issue events map the operation to the actual bus key and closure',async()=>{
  const found=await closure().inspect();
  assert.deepEqual(found,{key:'media:2026-10-12:coordination',blockerCommentId:'6125587057',
    completionCommentId:6125747183,closed:true});
  assert.equal(await closure().isClosed(found.key),true);
  await assert.rejects(closure().isClosed(`operations:${captured.operation.runId}:${captured.operation.deploymentSha}`),/operation_bus_key_mismatch/);
});
test('read-only replay starts from the failed operation and never writes a second close',async()=>{
  const bus=closure(), mapped=await bus.inspect();
  let writes=0,closes=0,saves=0;
  const args={key:mapped.key,load:async()=>null,save:async()=>{saves++},acquire:async()=>async()=>{},
    isClosed:bus.isClosed,close:async()=>{closes++},
    steps:[{id:'deployment',reconcile:async()=> 'done',verify:async()=>true,run:async()=>{writes++}}]};
  assert.equal((await recover(args)).status,'completed');
  assert.equal(writes,0);assert.equal(closes,0);assert.ok(saves>0);
});
test('missing or ambiguous operation mapping blocks before recovery writes',async()=>{
  const missing=captured.comments.map(c=>({...c,body:c.body.replaceAll(captured.operation.runId,'unmatched-run')}));
  await assert.rejects(closure(missing).inspect(),/operation_bus_mapping_missing_or_conflicting/);
  const duplicate=[...captured.comments,captured.comments[0]];
  await assert.rejects(closure(duplicate).inspect(),/operation_bus_mapping_missing_or_conflicting/);
  const unlinked=captured.comments.map(c=>c.id===6125747183?{...c,body:c.body.replace('comment6125587057','unlinked blocker')}:c);
  await assert.rejects(closure(unlinked).inspect(),/operation_bus_closure_conflicting/);
});
