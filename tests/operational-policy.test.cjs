const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawnSync}=require('node:child_process');
const {resolvePolicy}=require('../lib/operational-policy.cjs');
const root=path.resolve(__dirname,'..');
test('all existing task roles resolve canonical bytes without claiming review or activation',()=>{
 for(const role of ['daily-publisher','cuai-operating-system','cuai-media-coordinator']){
  const result=resolvePolicy(role);assert.ok(result.sources.every(s=>/^[a-f0-9]{64}$/.test(s.sha256)));
  assert.equal(result.endUserReviewVerified,false);assert.equal(result.scheduledActivationVerified,false);assert.equal(result.liveDeliveryVerified,false);
 }
 assert.throws(()=>resolvePolicy('new-manager'),/unknown-operational-role/);
});
test('required policy preflight rejects absent sources or missing markers and recovers only source readiness',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'cuai-policy-normal-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const files=['scripts/check-operational-policy.cjs','lib/operational-policy.cjs',...resolvePolicy('cuai-media-coordinator').sources.map(s=>s.path)];
 for(const file of files){fs.mkdirSync(path.dirname(path.join(dir,file)),{recursive:true});fs.copyFileSync(path.join(root,file),path.join(dir,file));}
 const invoke=(args=['cuai-media-coordinator'])=>spawnSync(process.execPath,[path.join(dir,'scripts/check-operational-policy.cjs'),...args],{encoding:'utf8'});
 let r=invoke();assert.equal(r.status,0,r.stderr);const initial=JSON.parse(r.stdout);assert.equal(initial.endUserReviewVerified,false);
 const policy=path.join(dir,'automation/scheduled-tasks/cuai-media-coordinator.md'),bytes=fs.readFileSync(policy);
 fs.unlinkSync(policy);r=invoke();assert.notEqual(r.status,0);assert.match(r.stderr,/controlling-policy-unavailable/);
 fs.writeFileSync(policy,bytes.toString().replace('<!-- cuai-cycle-acceptance-v1 -->',''));
 r=invoke();assert.notEqual(r.status,0);assert.match(r.stderr,/cycle-acceptance-missing/);
 fs.writeFileSync(policy,bytes);r=invoke();assert.equal(r.status,0,r.stderr);assert.deepEqual(JSON.parse(r.stdout).sources,initial.sources);
 fs.appendFileSync(policy,'\nPrivate test edit.\n');r=invoke();assert.equal(r.status,0);assert.notDeepEqual(JSON.parse(r.stdout).sources,initial.sources);
 fs.unlinkSync(policy);fs.symlinkSync(path.join(root,'automation/scheduled-tasks/cuai-media-coordinator.md'),policy);r=invoke();assert.notEqual(r.status,0);assert.match(r.stderr,/shadowed-policy/);
});

test('existing PR design path invokes every role preflight',()=>{const workflow=fs.readFileSync(path.join(root,'.github/workflows/cuai-operations.yml'),'utf8');for(const role of ['daily-publisher','cuai-operating-system','cuai-media-coordinator'])assert.ok(workflow.includes('node scripts/check-operational-policy.cjs '+role));});
