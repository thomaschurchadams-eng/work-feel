'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {reliabilityWatchSession}=require('../automation/recovery/reliability-watch-session.cjs');
const {loadReliabilityWatchSession}=require('../automation/recovery/task-tool-loader.cjs');
const captured=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/recovery/issue160-oct12.json'),'utf8'));

function fake({closed=false,lostResponse=false}={}) {
  const branch='test/recovery-checkpoint',file='checkpoint.json';
  const base='a'.repeat(40), commits=new Map([[base,{tree:'b'.repeat(40),files:{[file]:JSON.stringify({leases:{},states:{}})}}]]);
  const trees=new Map();let head=base,serial=1,lose=lostResponse;
  let comments=closed?[...captured.comments]:[captured.comments[0]];
  const ok=structuredContent=>({structuredContent,isError:false});
  const sha=()=>String(serial++).padStart(40,'0');
  const tools={
    async mcp__codex_apps__github_fetch_issue_comments(){return ok({comments})},
    async mcp__codex_apps__github_fetch({url}) {
      if(url.includes('/git/ref/heads/'))return ok({content:JSON.stringify({ref:`refs/heads/${branch}`,object:{sha:head}})});
      const commit=commits.get(url.split('/').pop());return ok({content:JSON.stringify({tree:{sha:commit.tree}})});
    },
    async mcp__codex_apps__github_fetch_file({ref,path:p}){return ok({content:commits.get(ref).files[p]})},
    async mcp__codex_apps__github_create_blob(){return ok({sha:sha()})},
    async mcp__codex_apps__github_create_tree({base_tree_sha,tree_elements}){
      const prior=[...commits.values()].find(c=>c.tree===base_tree_sha);
      const files={...prior.files};for(const entry of tree_elements)files[entry.path]=entry.content;
      const tree=sha();trees.set(tree,files);return ok({sha:tree});
    },
    async mcp__codex_apps__github_create_commit({parent_sha,tree_sha}){
      const commit=sha();commits.set(commit,{tree:tree_sha,files:trees.get(tree_sha),parent:parent_sha});return ok({sha:commit});
    },
    async mcp__codex_apps__github_update_ref({sha:commit,expected_sha,force}){
      assert.equal(force,false);
      if(head!==expected_sha)return {isError:true,content:[{type:'text',text:'UNKNOWN'}]};
      head=commit;if(lose){lose=false;return {isError:true,content:[{type:'text',text:'UNKNOWN'}]}};
      return ok({success:true});
    }
  };
  const args={tools,repository:captured.repository,checkpointBranch:branch,checkpointPath:file,
    executionId:'test-run-38257568883',executionStatus:async()=>({stopped:false}),casVerified:true,
    operation:captured.operation};
  return {args,head:()=>head,document:()=>JSON.parse(commits.get(head).files[file]),
    comments:()=>comments,appendCompletion:()=>{comments=[...comments,captured.comments[1]]},
    seedLease:()=>{commits.get(head).files[file]=JSON.stringify({leases:{'media:2026-10-12:coordination':{executionId:'prior-run-1',token:'prior-token'}},states:{}})}};
}

test('already-closed real incident returns before any checkpoint or close write',async()=>{
  const f=fake({closed:true});let writes=0,closes=0;
  const result=await reliabilityWatchSession({...f.args,steps:[{id:'deployment',reconcile:async()=>{writes++},verify:async()=>true,run:async()=>{writes++}}],closeBusKey:async()=>{closes++}});
  assert.equal(result.key,'media:2026-10-12:coordination');
  assert.equal(result.alreadyClosed,true);assert.equal(writes,0);assert.equal(closes,0);
  assert.equal(f.head(),'a'.repeat(40));
});

test('task tool runtime loads only pinned recovery modules and replays closed key read-only',async()=>{
  const f=fake({closed:true}),original=f.args.tools.mcp__codex_apps__github_fetch_file;
  f.args.tools.mcp__codex_apps__github_fetch_file=async({path:p,ref,...other})=>{
    if(p.startsWith('automation/recovery/') && p.endsWith('.cjs'))
      return {structuredContent:{content:fs.readFileSync(path.join(__dirname,'..',p),'utf8')},isError:false};
    return original({path:p,ref,...other});
  };
  await assert.rejects(loadReliabilityWatchSession({tools:f.args.tools,repository:captured.repository,ref:'main'}),/recovery_source_ref_unpinned/);
  const run=await loadReliabilityWatchSession({tools:f.args.tools,repository:captured.repository,ref:'f'.repeat(40)});
  let closes=0;const result=await run({...f.args,steps:[{id:'deployment',reconcile:async()=>{throw Error('should not run')},verify:async()=>true,run:async()=>{}}],closeBusKey:async()=>{closes++}});
  assert.equal(result.alreadyClosed,true);assert.equal(closes,0);
});

test('delayed deployment resumes from saved checkpoint and closes original bus key once',async()=>{
  const f=fake({lostResponse:true});let ready=false,checks=0,writes=0,closes=0;
  const steps=[{id:'deployment',safeToResume:true,reconcile:async()=>ready?'done':'not-done',
    verify:async()=>ready,run:async()=>{checks++;throw Error('deployment not ready')}}];
  const closeBusKey=async({key,blockerCommentId})=>{
    assert.equal(key,'media:2026-10-12:coordination');assert.equal(blockerCommentId,'6125587057');
    closes++;f.appendCompletion();
  };
  assert.equal((await reliabilityWatchSession({...f.args,steps,closeBusKey})).status,'retryable');
  assert.equal(f.document().states['media:2026-10-12:coordination'].steps.deployment.status,'started');
  ready=true;
  assert.equal((await reliabilityWatchSession({...f.args,steps,closeBusKey})).status,'completed');
  assert.equal((await reliabilityWatchSession({...f.args,steps,closeBusKey})).alreadyClosed,true);
  assert.equal(checks,1);assert.equal(writes,0);assert.equal(closes,1);
});

test('write-success/output-failure blocks duplicate action despite another callback',async()=>{
  const f=fake();let stored=false,writes=0,closes=0;
  const steps=[{id:'external-write',reconcile:async()=>stored?'ambiguous':'not-done',verify:async()=>false,
    run:async()=>{writes++;stored=true;throw Object.assign(Error('output failed'),{mayHaveCommitted:true})}}];
  const closeBusKey=async()=>{closes++};
  assert.equal((await reliabilityWatchSession({...f.args,steps,closeBusKey})).status,'blocked-ambiguous');
  assert.equal((await reliabilityWatchSession({...f.args,steps,closeBusKey})).status,'blocked-ambiguous');
  assert.equal(writes,1);assert.equal(closes,0);
});

test('competing callbacks cannot duplicate the same external write',async()=>{
  const f=fake();let written=false,writes=0,closes=0;
  const steps=[{id:'external-write',reconcile:async()=>written?'done':'not-done',verify:async()=>written,
    run:async()=>{writes++;written=true}}];
  const closeBusKey=async()=>{closes++;f.appendCompletion()};
  const attempts=await Promise.allSettled([
    reliabilityWatchSession({...f.args,executionId:'test-run-racer-a',steps,closeBusKey}),
    reliabilityWatchSession({...f.args,executionId:'test-run-racer-b',steps,closeBusKey})
  ]);
  assert.ok(attempts.some(x=>x.status==='fulfilled'));
  assert.equal(writes,1);assert.equal(closes,1);
  assert.equal((await reliabilityWatchSession({...f.args,steps,closeBusKey})).alreadyClosed,true);
  assert.equal(writes,1);assert.equal(closes,1);
});

test('missing mapping and unknown prior lease owner stop before external action',async()=>{
  const f=fake();let writes=0;
  const steps=[{id:'write',reconcile:async()=> 'not-done',verify:async()=>true,run:async()=>{writes++}}];
  const closeBusKey=async()=>{};
  const bad={...f.args,operation:{...f.args.operation,runId:'99999999999'}};
  await assert.rejects(reliabilityWatchSession({...bad,steps,closeBusKey}),/operation_bus_mapping_missing_or_conflicting/);
  assert.equal(writes,0);assert.equal(f.head(),'a'.repeat(40));
  f.seedLease();
  await assert.rejects(reliabilityWatchSession({...f.args,executionStatus:async()=>false,steps,closeBusKey}),/recovery_lease_busy/);
  assert.equal(writes,0);assert.equal(f.document().leases['media:2026-10-12:coordination'].token,'prior-token');
});
