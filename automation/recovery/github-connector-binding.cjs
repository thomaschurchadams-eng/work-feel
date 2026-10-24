'use strict';

// Bind the existing task's GitHub connector to gitRefCheckpointStore. This
// module does not create a branch, schedule, token, or production operation.
function githubConnectorBinding({tools, repository, branch, path}) {
  if (!tools || !repository || !branch || !path) throw Error('checkpoint_binding_missing');
  const required=['mcp__codex_apps__github_fetch','mcp__codex_apps__github_fetch_file',
    'mcp__codex_apps__github_create_tree','mcp__codex_apps__github_create_commit',
    'mcp__codex_apps__github_update_ref'];
  if (required.some(name=>typeof tools[name]!=='function')) throw Error('checkpoint_connector_missing');
  const refUrl=`https://api.github.com/repos/${repository}/git/ref/heads/${branch}`;
  function result(value) {
    if (value?.isError) throw Error('checkpoint_connector_error');
    return value?.structuredContent || value;
  }
  function refSha(value) {
    const outer=result(value);
    const ref=JSON.parse(outer.content);
    if (ref.ref!==`refs/heads/${branch}` || !/^[0-9a-f]{40}$/.test(ref.object?.sha||'')) throw Error('checkpoint_ref_invalid');
    return ref.object.sha;
  }
  async function read() {
    const sha=refSha(await tools.mcp__codex_apps__github_fetch({url:refUrl}));
    const file=result(await tools.mcp__codex_apps__github_fetch_file({
      repository_full_name:repository,path,ref:sha,encoding:'utf-8'}));
    if(typeof file.content!=='string') throw Error('checkpoint_document_invalid');
    const document=JSON.parse(file.content);
    if(!document || typeof document!=='object' || Array.isArray(document)) throw Error('checkpoint_document_invalid');
    return {sha,document};
  }
  async function cas(expectedSha,document) {
    if(!/^[0-9a-f]{40}$/.test(expectedSha||'')) throw Error('checkpoint_expected_sha_invalid');
    const base=result(await tools.mcp__codex_apps__github_fetch({
      url:`https://api.github.com/repos/${repository}/git/commits/${expectedSha}`
    }));
    const baseTree=JSON.parse(base.content).tree?.sha;
    if(!/^[0-9a-f]{40}$/.test(baseTree||'')) throw Error('checkpoint_base_tree_invalid');
    const tree=result(await tools.mcp__codex_apps__github_create_tree({
      repository_full_name:repository,base_tree_sha:baseTree,
      tree_elements:[{path,mode:'100644',type:'blob',content:JSON.stringify(document)+'\n'}]
    }));
    if(!/^[0-9a-f]{40}$/.test(tree.sha||'')) throw Error('checkpoint_tree_invalid');
    const commit=result(await tools.mcp__codex_apps__github_create_commit({
      repository_full_name:repository,parent_sha:expectedSha,tree_sha:tree.sha,
      message:'Checkpoint recovery state'
    }));
    if(!/^[0-9a-f]{40}$/.test(commit.sha||'')) throw Error('checkpoint_commit_invalid');
    const updated=result(await tools.mcp__codex_apps__github_update_ref({
      repository_full_name:repository,branch_name:branch,sha:commit.sha,
      expected_sha:expectedSha,force:false
    }));
    if(updated.success!==true) throw Error('checkpoint_update_unconfirmed');
    return updated;
  }
  return {read,cas};
}
module.exports={githubConnectorBinding};
