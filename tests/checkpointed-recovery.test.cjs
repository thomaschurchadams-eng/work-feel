const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { recover } = require('../automation/recovery/checkpointed-recovery.cjs');
const { fileStore } = require('../automation/recovery/file-store.cjs');
const key = 'incident:run38257568883';
function fixture(steps, initial) {
  let state = initial, writes = 0, closes = [], closed = false, held = false;
  const args = { key, steps, maxAttempts:2,
    acquire:async()=>{ while(held) await new Promise(r=>setTimeout(r,1)); held=true; return async()=>{held=false} },
    load:async()=>state, save:async s=>{state=structuredClone(s)},
    isClosed:async()=>closed, close:async k=>{closes.push(k);closed=true}
  };
  return { args, get:()=>({state,writes,closes}), write:()=>{writes++} };
}
test('deployment becomes ready after failed wait; original incident closes without a write', async () => {
  let ready = true;
  const f = fixture([{ id:'deployment', reconcile:async()=>ready?'done':'not-done', run:async()=>{throw Error('should not run')}, verify:async()=>ready }]);
  assert.equal((await recover(f.args)).status,'completed');
  assert.deepEqual(f.get().closes,[key]);
});
test('interrupted stage reconciles prior write before resuming', async () => {
  let written=true, next=false;
  const f=fixture([{id:'write',reconcile:async()=>written?'done':'not-done',run:async()=>f.write(),verify:async()=>written},{id:'verify',reconcile:async()=>next?'done':'not-done',run:async()=>{next=true},verify:async()=>next}],{key,status:'working',attempts:0,steps:{write:{status:'started'}}});
  assert.equal((await recover(f.args)).status,'completed'); assert.equal(f.get().writes,0);
});
test('simultaneous callbacks have one write and one close through atomic lease', async () => {
  let written=false;
  const f=fixture([{id:'write',reconcile:async()=>written?'done':'not-done',run:async()=>{await new Promise(r=>setTimeout(r,5));f.write();written=true},verify:async()=>written}]);
  const results=await Promise.all([recover(f.args),recover(f.args)]);
  assert.deepEqual(results.map(x=>x.status),['completed','completed']);
  assert.equal(f.get().writes,1); assert.equal(f.get().closes.length,1);
});
test('successful close with failed final save does not close again', async () => {
  let done=true, fail=true;
  const f=fixture([{id:'write',reconcile:async()=>done?'done':'not-done',run:async()=>{throw Error('should not run')},verify:async()=>done}]);
  const original=f.args.save;
  f.args.save=async s=>{if(s.status==='completed'&&fail){fail=false;throw Error('format failure')} await original(s)};
  await assert.rejects(recover(f.args),/format failure/);
  assert.equal((await recover(f.args)).status,'completed');
  assert.equal(f.get().closes.length,1);
});
test('exhausted retry budget still reconciles delayed external success', async () => {
  let ready=false, calls=0;
  const f=fixture([{id:'deployment',safeToResume:true,reconcile:async()=>ready?'done':'not-done',run:async()=>{calls++;throw Error('not ready')},verify:async()=>ready}],{key,status:'exhausted',attempts:2,steps:{deployment:{status:'started'}}});
  assert.equal((await recover(f.args)).status,'exhausted');
  ready=true;
  assert.equal((await recover(f.args)).status,'completed'); assert.equal(calls,0); assert.equal(f.get().closes.length,1);
});
test('write success followed by output failure never duplicates write', async () => {
  let written=true;
  const f=fixture([{id:'write',reconcile:async()=>written?'done':'not-done',run:async()=>f.write(),verify:async()=>written}],{key,status:'working',attempts:0,steps:{write:{status:'started'}}});
  await recover(f.args); assert.equal(f.get().writes,0);
});
test('permission denial and ambiguous outcome stop without unchanged approval retry', async () => {
  let calls=0;
  const f=fixture([{id:'external',reconcile:async()=> 'not-done',run:async()=>{calls++;throw Object.assign(Error('denied'),{status:403})},verify:async()=>true}]);
  assert.equal((await recover(f.args)).status,'blocked-permission'); await recover(f.args); assert.equal(calls,1);
  const g=fixture([{id:'external',reconcile:async()=> 'ambiguous',run:async()=>{throw Error('should not run')},verify:async()=>true}]);
  assert.equal((await recover(g.args)).status,'blocked-ambiguous');
});
test('file adapter serializes simultaneous calls and keeps a durable checkpoint', async () => {
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'cuai-recovery-'));
  try {
    const store=fileStore(directory); let written=false, writes=0, closed=false, closes=0;
    const args={key,steps:[{id:'write',reconcile:async()=>written?'done':'not-done',run:async()=>{writes++;written=true},verify:async()=>written}],...store,isClosed:async()=>closed,close:async()=>{closes++;closed=true}};
    await Promise.all([recover(args),recover(args)]);
    assert.equal(writes,1); assert.equal(closes,1);
    assert.equal((await store.load(key)).status,'completed');
  } finally { await fs.rm(directory,{recursive:true,force:true}); }
});

test('permission denial in prior-result verification is persisted and never repeated', async () => {
  let verifies=0;
  const f=fixture([{id:'write',reconcile:async()=> 'done',run:async()=>{},verify:async()=>{verifies++;throw Object.assign(Error('denied'),{status:403})}}]);
  assert.equal((await recover(f.args)).status,'blocked-permission');
  assert.equal((await recover(f.args)).status,'blocked-permission');
  assert.equal(verifies,1);
});
test('permission denial in post-run reconciliation is persisted and never repeated', async () => {
  let reads=0, writes=0;
  const f=fixture([{id:'write',reconcile:async()=>{reads++;if(reads>1)throw Object.assign(Error('denied'),{status:403});return 'not-done'},run:async()=>{writes++},verify:async()=>true}]);
  assert.equal((await recover(f.args)).status,'blocked-permission');
  assert.equal((await recover(f.args)).status,'blocked-permission');
  assert.equal(reads,2);assert.equal(writes,1);
});
test('permission denial in post-run verification is persisted and never repeated', async () => {
  let verified=0;
  const f=fixture([{id:'write',reconcile:(()=>{let n=0;return async()=>++n===1?'not-done':'done'})(),run:async()=>{},verify:async()=>{verified++;throw Object.assign(Error('denied'),{status:403})}}]);
  assert.equal((await recover(f.args)).status,'blocked-permission');
  assert.equal((await recover(f.args)).status,'blocked-permission');
  assert.equal(verified,1);
});
test('permission denial in incident closure is persisted and never repeated', async () => {
  let closes=0;
  const f=fixture([{id:'write',reconcile:async()=> 'done',run:async()=>{},verify:async()=>true}]);
  f.args.close=async()=>{closes++;throw Object.assign(Error('denied'),{status:403})};
  assert.equal((await recover(f.args)).status,'blocked-permission');
  assert.equal((await recover(f.args)).status,'blocked-permission');
  assert.equal(closes,1);
});

test('malformed truthy incident state cannot mark recovery completed', async () => {
  let closes=0;
  const f=fixture([{id:'read',reconcile:async()=> 'done',run:async()=>{},verify:async()=>true}]);
  f.args.isClosed=async()=>({closed:false});
  f.args.close=async()=>{closes++};
  assert.equal((await recover(f.args)).status,'blocked-ambiguous');
  assert.equal(closes,0);
});
test('dead worker lease is reclaimed once; competing resumers serialize', async () => {
  const {spawnSync}=require('node:child_process');
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'cuai-recovery-crash-'));
  try {
    const modulePath=require.resolve('../automation/recovery/file-store.cjs');
    const child=spawnSync(process.execPath,['-e',`const {fileStore}=require(${JSON.stringify(modulePath)});fileStore(${JSON.stringify(directory)}).acquire(${JSON.stringify(key)}).then(()=>process.exit(0));`],{encoding:'utf8'});
    assert.equal(child.status,0,child.stderr);
    const store=fileStore(directory); let written=false,writes=0,closed=false,closes=0;
    const args={key,steps:[{id:'write',reconcile:async()=>written?'done':'not-done',run:async()=>{writes++;written=true},verify:async()=>written}],...store,isClosed:async()=>closed,close:async()=>{closes++;closed=true}};
    const results=await Promise.all([recover(args),recover(args)]);
    assert.deepEqual(results.map(x=>x.status),['completed','completed']);
    assert.equal(writes,1);assert.equal(closes,1);
  } finally { await fs.rm(directory,{recursive:true,force:true}); }
});

test('durable adapter closes original delayed-deployment incident after readiness changes', async () => {
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'cuai-recovery-deployment-'));
  try {
    const store=fileStore(directory),incident='operations:38257568883:eb075a6';
    await store.save({key:incident,status:'exhausted',attempts:2,steps:{deployment:{status:'started'}}});
    let ready=false,closes=0,closed=false,writes=0;
    const args={key:incident,...store,steps:[{id:'deployment',safeToResume:true,reconcile:async()=>ready?'done':'not-done',run:async()=>{writes++},verify:async()=>ready}],isClosed:async()=>closed,close:async actual=>{assert.equal(actual,incident);closes++;closed=true}};
    assert.equal((await recover(args)).status,'exhausted');
    ready=true;
    assert.equal((await recover(args)).status,'completed');
    assert.equal(writes,0);assert.equal(closes,1);
    assert.equal((await store.load(incident)).status,'completed');
  } finally { await fs.rm(directory,{recursive:true,force:true}); }
});
test('durable adapter resumes only unfinished safe step after interrupted stage', async () => {
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'cuai-recovery-resume-'));
  try {
    const store=fileStore(directory);await store.save({key,status:'working',attempts:1,steps:{write:{status:'started'}}});
    let written=true,verified=false,writes=0,closed=false;
    const args={key,...store,steps:[{id:'write',reconcile:async()=>written?'done':'ambiguous',run:async()=>{writes++},verify:async()=>written},{id:'verify',safeToResume:true,reconcile:async()=>verified?'done':'not-done',run:async()=>{verified=true},verify:async()=>verified}],isClosed:async()=>closed,close:async()=>{closed=true}};
    assert.equal((await recover(args)).status,'completed');assert.equal(writes,0);
    assert.deepEqual((await store.load(key)).steps,{write:{status:'verified'},verify:{status:'verified'}});
  } finally { await fs.rm(directory,{recursive:true,force:true}); }
});
