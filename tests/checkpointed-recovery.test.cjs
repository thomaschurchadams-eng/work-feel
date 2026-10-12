const test = require('node:test');
const assert = require('node:assert/strict');
const { recover } = require('../automation/recovery/checkpointed-recovery.cjs');
function fixture(steps, initial) {
  let state = initial, writes = 0, closes = [];
  return { args: { key: 'incident:run38257568883', steps, load: async () => state, save: async s => { state = structuredClone(s); }, close: async key => { closes.push(key); } }, get: () => ({ state, writes, closes }), write: () => { writes++; } };
}
test('deployment becomes ready after failed wait; original incident closes without a write', async () => {
  let ready = true;
  const f = fixture([{ id: 'deployment', reconcile: async () => ready ? 'done' : 'not-done', run: async () => { throw Error('should not run'); }, verify: async () => ready }]);
  assert.equal((await recover(f.args)).status, 'completed');
  assert.deepEqual(f.get().closes, ['incident:run38257568883']);
});
test('interrupted stage reconciles the prior write before resuming', async () => {
  let written = true, next = false;
  const f = fixture([{ id:'write', reconcile:async()=>written?'done':'not-done', run:async()=>f.write(), verify:async()=>written }, { id:'verify', reconcile:async()=>next?'done':'not-done', run:async()=>{next=true}, verify:async()=>next }], { key:'incident:run38257568883', status:'working', attempts:0, steps:{write:{status:'started'}} });
  assert.equal((await recover(f.args)).status, 'completed'); assert.equal(f.get().writes, 0);
});
test('duplicate callback is idempotent', async () => {
  let written = false;
  const f = fixture([{ id:'write', reconcile:async()=>written?'done':'not-done', run:async()=>{ f.write(); written=true }, verify:async()=>written }]);
  await recover(f.args); await recover(f.args);
  assert.equal(f.get().writes, 1); assert.equal(f.get().closes.length, 1);
});
test('write success followed by output-format failure never duplicates the write', async () => {
  let written = true;
  const f = fixture([{ id:'write', reconcile:async()=>written?'done':'not-done', run:async()=>f.write(), verify:async()=>written }], { key:'incident:run38257568883', status:'working', attempts:0, steps:{write:{status:'started'}} });
  await recover(f.args); assert.equal(f.get().writes, 0);
});
test('interrupted safe stage resumes only with an explicit replay guarantee', async () => {
  let ready=false, calls=0;
  const f=fixture([{id:'deployment-read',safeToResume:true,reconcile:async()=>ready?'done':'not-done',run:async()=>{calls++;ready=true},verify:async()=>ready}], {key:'incident:run38257568883',status:'working',attempts:0,steps:{'deployment-read':{status:'started'}}});
  assert.equal((await recover(f.args)).status,'completed'); assert.equal(calls,1);
});
test('permission denial and ambiguous outcome stop without unchanged approval retry', async () => {
  let calls=0;
  const f=fixture([{id:'external', reconcile:async()=> 'not-done', run:async()=>{calls++; throw Object.assign(Error('denied'),{status:403})}, verify:async()=>true}]);
  assert.equal((await recover(f.args)).status,'blocked-permission'); await recover(f.args); assert.equal(calls,1);
  const g=fixture([{id:'external',reconcile:async()=> 'ambiguous',run:async()=>{throw Error('should not run')},verify:async()=>true}]);
  assert.equal((await recover(g.args)).status,'blocked-ambiguous');
});
