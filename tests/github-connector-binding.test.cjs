'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {githubConnectorBinding}=require('../automation/recovery/github-connector-binding.cjs');
const {gitRefCheckpointStore}=require('../automation/recovery/git-ref-checkpoint-store.cjs');

function fakeConnector() {
  const base='a'.repeat(40), branch='test/checkpoint', path='checkpoint.json';
  let head=base, next=1, unknown=false;
  const commits=new Map([[base,{tree:'b'.repeat(40),files:{[path]:JSON.stringify({states:{},leases:{}}),keep:'untouched'}}]]);
  const trees=new Map();
  const sha=()=>String(next++).padStart(40,'0');
  const ok=structuredContent=>({structuredContent,isError:false});
  const tools={
    async mcp__codex_apps__github_fetch({url}) {
      if(url.includes('/git/ref/heads/')) return ok({content:JSON.stringify({ref:`refs/heads/${branch}`,object:{sha:head}})});
      const commit=commits.get(url.split('/').pop());
      if(!commit) throw Error('commit_missing');
      return ok({content:JSON.stringify({tree:{sha:commit.tree}})});
    },
    async mcp__codex_apps__github_fetch_file({ref,path:p}) {
      return ok({content:commits.get(ref).files[p]});
    },
    async mcp__codex_apps__github_create_tree({base_tree_sha,tree_elements}) {
      const prior=[...commits.values()].find(c=>c.tree===base_tree_sha);
      const files={...prior.files};
      for(const entry of tree_elements) files[entry.path]=entry.content;
      const tree=sha(); trees.set(tree,files); return ok({sha:tree});
    },
    async mcp__codex_apps__github_create_commit({parent_sha,tree_sha}) {
      const commit=sha(); commits.set(commit,{tree:tree_sha,files:trees.get(tree_sha),parent:parent_sha});
      return ok({sha:commit});
    },
    async mcp__codex_apps__github_update_ref({sha:commit,expected_sha,force}) {
      assert.equal(force,false);
      if(head!==expected_sha) return {isError:true,content:[{type:'text',text:'UNKNOWN'}]};
      head=commit;
      if(unknown) { unknown=false; return {isError:true,content:[{type:'text',text:'UNKNOWN'}]}; }
      return ok({success:true});
    }
  };
  return {tools,branch,path,base,head:()=>head,files:()=>commits.get(head).files,loseNextResponse:()=>{unknown=true;}};
}

test('connector binding preserves other files and supplies a durable checkpoint lease',async()=>{
  const api=fakeConnector();
  const binding=githubConnectorBinding({tools:api.tools,repository:'owner/repo',branch:api.branch,path:api.path});
  const store=gitRefCheckpointStore({...binding,executionId:'test-run-1',ownerLive:async()=>({stopped:false}),casVerified:true});
  const release=await store.acquire('incident');
  await store.save({key:'incident',phase:'verified'});
  assert.equal((await store.load('incident')).phase,'verified');
  assert.equal(api.files().keep,'untouched');
  await release();
});

test('lost success response is reconciled by transaction readback',async()=>{
  const api=fakeConnector();
  const binding=githubConnectorBinding({tools:api.tools,repository:'owner/repo',branch:api.branch,path:api.path});
  const store=gitRefCheckpointStore({...binding,executionId:'test-run-2',ownerLive:async()=>({stopped:false}),casVerified:true});
  api.loseNextResponse();
  const release=await store.acquire('incident');
  assert.ok(api.head()!==api.base);
  await release();
});

test('competing stale update cannot overwrite the winner',async()=>{
  const api=fakeConnector();
  const binding=githubConnectorBinding({tools:api.tools,repository:'owner/repo',branch:api.branch,path:api.path});
  const first=await binding.read();
  await binding.cas(first.sha,{winner:'first'});
  await assert.rejects(binding.cas(first.sha,{winner:'second'}),/checkpoint_connector_error/);
  assert.equal((await binding.read()).document.winner,'first');
});

test('lease recovery needs exact execution stop evidence; unknown owner blocks',async()=>{
  const api=fakeConnector();
  const binding=githubConnectorBinding({tools:api.tools,repository:'owner/repo',branch:api.branch,path:api.path});
  const first=gitRefCheckpointStore({...binding,executionId:'task-run-1',ownerLive:async()=>({stopped:false}),casVerified:true});
  await first.acquire('incident'); // Simulated process exit leaves its lease.
  const uncertain=gitRefCheckpointStore({...binding,executionId:'task-run-2',ownerLive:async()=>false,casVerified:true});
  await assert.rejects(uncertain.acquire('incident'),/recovery_lease_busy/);
  const second=gitRefCheckpointStore({...binding,executionId:'task-run-2',ownerLive:async id=>{
    assert.equal(id,'task-run-1');return {stopped:true,evidence:'authoritative execution terminal receipt'};
  },casVerified:true});
  const release=await second.acquire('incident');
  assert.equal((await binding.read()).document.leases.incident.executionId,'task-run-2');
  await release();
});
