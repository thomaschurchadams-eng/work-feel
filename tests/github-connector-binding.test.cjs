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
      if(head!==expected_sha) throw Error('UNKNOWN');
      head=commit;
      if(unknown) { unknown=false; throw Error('UNKNOWN'); }
      return ok({success:true});
    }
  };
  return {tools,branch,path,base,head:()=>head,files:()=>commits.get(head).files,loseNextResponse:()=>{unknown=true;}};
}

test('connector binding preserves other files and supplies a durable checkpoint lease',async()=>{
  const api=fakeConnector();
  const binding=githubConnectorBinding({tools:api.tools,repository:'owner/repo',branch:api.branch,path:api.path});
  const store=gitRefCheckpointStore({...binding,ownerId:'test-worker',ownerLive:async()=>true,casVerified:true});
  const release=await store.acquire('incident');
  await store.save({key:'incident',phase:'verified'});
  assert.equal((await store.load('incident')).phase,'verified');
  assert.equal(api.files().keep,'untouched');
  await release();
});

test('lost success response is reconciled by transaction readback',async()=>{
  const api=fakeConnector();
  const binding=githubConnectorBinding({tools:api.tools,repository:'owner/repo',branch:api.branch,path:api.path});
  const store=gitRefCheckpointStore({...binding,ownerId:'test-worker',ownerLive:async()=>true,casVerified:true});
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
  await assert.rejects(binding.cas(first.sha,{winner:'second'}),/UNKNOWN/);
  assert.equal((await binding.read()).document.winner,'first');
});
