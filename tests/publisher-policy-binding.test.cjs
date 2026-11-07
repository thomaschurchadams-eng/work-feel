'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), crypto = require('node:crypto');
const policy = fs.readFileSync(path.join(__dirname,'../automation/scheduled-tasks/publish-cuai-daily-article.md'),'utf8');
const code = policy.split('#### Executable binding in the tools runtime')[1].match(/```javascript\n([\s\S]*?)```/)[1];
const source = fs.readFileSync(path.join(__dirname,'../lib/publisher-validation.cjs'),'utf8');
const blob = crypto.createHash('sha1').update(`blob ${Buffer.byteLength(source)}\0`).update(source).digest('hex');
const main = 'b'.repeat(40), head = 'a'.repeat(40);
const pending = {prNumber:268,head,run:101,job:201,runAttempt:1,accountableOwner:'daily-publisher',nextReviewAt:'2026-11-07T17:30:00Z'};
function fixture(options={}) {
  const calls=[];
  const tools={
    mcp__codex_apps__github_fetch:async args=>{
      calls.push(args.url);
      if(args.url.endsWith('/commits/main'))return {structuredContent:{content:JSON.stringify({sha:main})}};
      return {structuredContent:{content:JSON.stringify(args.url.includes('/jobs?')?{jobs:[{id:201,run_id:101,head_sha:head,run_attempt:1,name:'design-checks',status:'completed',conclusion:'success'}]}:{id:101,head_sha:head,run_attempt:1,status:'completed',conclusion:'success',repository:{full_name:'thomaschurchadams-eng/work-feel'}})}};
    },
    mcp__codex_apps__github_fetch_file:async args=>{calls.push(args);if(options.denied)return {isError:true,structuredContent:{error:'denied',error_code:'FORBIDDEN'}};return {structuredContent:{encoding:'utf-8',sha:options.badBlob?'bad':blob,content:source}};},
    mcp__codex_apps__github_get_pr_info:async()=>{calls.push('pr');return {structuredContent:{head_sha:head,state:options.completed?'closed':'open',merged:!!options.completed}};},
    mcp__codex_apps__github_update_ref:()=>{throw Error('writer invoked');}
  };
  const fn=vm.runInNewContext(`${code}\ninspectOwnedValidation`,{tools});
  return {calls,run:()=>fn(pending)};
}
test('controlling policy loader runs without Node globals and reads source from exact current main',async()=>{
  assert.equal(blob,'3cf8d0c54f0031e2ac1bd388eda601dca6e1eed7');
  const f=fixture(),r=await f.run();assert.equal(r.decision,'awaiting-visual-review');assert.equal(r.releaseReady,false);assert.equal(r.accountableOwner,'daily-publisher');
  assert.equal(f.calls[1].ref,main);assert.equal(f.calls[1].path,'lib/publisher-validation.cjs');assert.equal(f.calls.length,5);
});
test('controlling loader refuses changed source identity before candidate reads',async()=>{const f=fixture({badBlob:true});await assert.rejects(f.run(),/source-unavailable-or-mismatched/);assert.equal(f.calls.length,2);});
test('controlling loader stops on denial without retrying or selecting a fallback source',async()=>{const f=fixture({denied:true});await assert.rejects(f.run(),/source-unavailable-or-mismatched/);assert.equal(f.calls.length,2);});
test('completed PR under the controlling loader performs no historical job/run reads',async()=>{const f=fixture({completed:true}),r=await f.run();assert.equal(r.decision,'reconcile-existing-release');assert.equal(r.shouldEscalate,false);assert.equal(f.calls.length,3);});
test('duplicate terminal reads remain read-only with no release grant',async()=>{const f=fixture();const a=await f.run(),b=await f.run();assert.equal(a.decision,b.decision);assert.equal(a.releaseReady,false);assert.equal(b.releaseReady,false);assert.equal(f.calls.length,10);});
