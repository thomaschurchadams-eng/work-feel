'use strict';

// Small bootstrap for the existing task's JavaScript tool runtime. Fetch only
// these reviewed modules at one immutable Git commit, then bind connector tools.
async function loadReliabilityWatchSession({tools,repository,ref}) {
  if(!tools || !repository || !/^[0-9a-f]{40}$/.test(ref||'')) throw Error('recovery_source_ref_unpinned');
  const names=['checkpointed-recovery','git-ref-checkpoint-store','github-connector-binding',
    'issue-bus-closure','reliability-watch-session'];
  const modules=new Map();
  for(const name of names) {
    const file=await tools.mcp__codex_apps__github_fetch_file({
      repository_full_name:repository,path:`automation/recovery/${name}.cjs`,ref,encoding:'utf-8'
    });
    const source=file?.structuredContent?.content;
    if(file?.isError || typeof source!=='string') throw Error(`recovery_module_unavailable:${name}`);
    const module={exports:{}};
    const requireKnown=specifier=>{
      if(specifier==='node:crypto') return {randomUUID:()=>{throw Error('task_crypto_unavailable')}};
      const target=specifier.match(/^\.\/(.+)\.cjs$/)?.[1];
      if(!target || !modules.has(target)) throw Error(`recovery_import_unavailable:${specifier}`);
      return modules.get(target);
    };
    new Function('module','require',source)(module,requireKnown);
    modules.set(name,module.exports);
  }
  const runner=modules.get('reliability-watch-session')?.reliabilityWatchSession;
  if(typeof runner!=='function') throw Error('recovery_runner_missing');
  return runner;
}

module.exports={loadReliabilityWatchSession};
