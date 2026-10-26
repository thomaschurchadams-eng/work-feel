const test=require('node:test');const assert=require('node:assert/strict');const {generateKeyPairSync,sign}=require('node:crypto');
const {verifyToken,AUDIENCE}=require('../lib/operations-auth');
const {publicKey,privateKey}=generateKeyPairSync('rsa',{modulusLength:2048});const jwk={...publicKey.export({format:'jwk'}),kid:'test',alg:'RS256'};const now=1800000000;
const valid={iss:'https://token.actions.githubusercontent.com',aud:AUDIENCE,sub:'repo:thomaschurchadams-eng/work-feel:ref:refs/heads/main',repository:'thomaschurchadams-eng/work-feel',repository_id:'1086718496',repository_owner_id:'241192016',ref:'refs/heads/main',workflow_ref:'thomaschurchadams-eng/work-feel/.github/workflows/cuai-operations.yml@refs/heads/main',runner_environment:'github-hosted',event_name:'push',iat:now,nbf:now,exp:now+300,run_id:'123'};
const token=(claims=valid,header={alg:'RS256',kid:'test',typ:'JWT'})=>{const body=[header,claims].map(x=>Buffer.from(JSON.stringify(x)).toString('base64url')).join('.');return body+'.'+sign('RSA-SHA256',Buffer.from(body),privateKey).toString('base64url');};
test('only the exact trusted workflow receives authorization',async()=>{assert.equal((await verifyToken(token(),async()=>[jwk],now)).runId,'123');assert.equal((await verifyToken(token({...valid,event_name:'schedule'}),async()=>[jwk],now)).runId,'123');for(const change of [{aud:'wrong'},{repository_id:'9'},{repository_owner_id:'9'},{ref:'refs/pull/1/merge'},{event_name:'pull_request'},{event_name:'deployment_status'},{workflow_ref:'other'},{sub:'other'},{exp:now-1},{iat:now-1000},{nbf:now+100},{runner_environment:'self-hosted'}])await assert.rejects(verifyToken(token({...valid,...change}),async()=>[jwk],now));});
test('signature, algorithm and key failures reject the token',async()=>{for(const bad of ['', 'public-commit-sha',token().slice(0,-5)+'abcde',token(valid,{alg:'none',kid:'test'})])await assert.rejects(verifyToken(bad,async()=>[jwk],now));await assert.rejects(verifyToken(token(),async()=>[],now));});
test('all endpoints reject public SHA-only calls before any downstream request',async()=>{let calls=0;const saved=global.fetch;global.fetch=async()=>{calls++;throw Error('Unexpected external request');};try{for(const name of ['buffer-schedule','buffer-schedule-image','buffer-schedule-tracked','buffer-metrics','ga4-metrics','search-console-metrics','operations-health']){const handler=require('../api/'+name);let status,result;const response={setHeader(){},status(value){status=value;return this;},json(value){result=value;return this;}};await handler({method:'POST',headers:{},query:{commitSha:'public'},body:{commitSha:'public'}},response);assert.equal(status,401,name);assert.equal(result.ok,false);}assert.equal(calls,0);}finally{global.fetch=saved;}});
const vm=require('node:vm');const fs=require('node:fs');
const runner=fs.readFileSync(require('node:path').join(__dirname,'../scripts/run-secure-operations.cjs'),'utf8');
async function runWorkflow({moved=false,healthFailure=false,timeout=false,queued=false,noReceipt=false,queueChanged=false,delayedHealth=false,productionDrift=null,sourceRace=null,queryFixture=false,refreshFailure=null,reconcile=false,metricFailure=false,nativeReceipt=null,nativeItem=false,nativeQueueChanged=false,videoSent=false,videoMissingAsset=false,env={},diagnosticFailure=null}={}){
 const sha='a'.repeat(40),productionSha=productionDrift||sourceRace?'c'.repeat(40):sha,calls=[],files={};let healthCalls=0,virtualNow=Date.now(),currentProductionSha=productionSha,refreshPending=false,refreshFaultInjected=false;class Clock extends Date {static now(){return virtualNow;}};const item={id:'linkedin-test',status:'queued',scheduledFor:new Date(Date.now()+86400000).toISOString(),articleUrl:'https://creditunionainews.com/article',copy:'example'};
 if(nativeItem)Object.assign(item,{mediaType:'video',videoUrl:'https://creditunionainews.com/assets/video-aaaaaaaaaaaa.mp4',videoSha256:'a'.repeat(64)});
 const scheduled={id:'scheduled-test',status:'scheduled',postId:'sent-post',scheduledFor:new Date(Date.now()-60000).toISOString(),articleUrl:'https://creditunionainews.com/sent-article',distributionUrl:'https://creditunionainews.com/sent-article?utm_source=linkedin',channelId:'channel-test'};
 if(videoSent||videoMissingAsset)Object.assign(scheduled,{status:'blocked',mediaType:'video',reconciliationRequired:true});
 const queueItems=[...(queued?[item]:[]),...(reconcile?[scheduled]:[])];
 const fakeFs={mkdirSync(){},writeFileSync(path,value){files[path]=value;},readFileSync(){return JSON.stringify({items:queueItems});}};
 const processStub={env:{DEPLOYED_SHA:sha,GITHUB_TOKEN:'github-fixture',ACTIONS_ID_TOKEN_REQUEST_URL:'https://identity.example/token',ACTIONS_ID_TOKEN_REQUEST_TOKEN:'fixture',...env}};
 const fetcher=async(url,options={})=>{calls.push({url:String(url),options});let body={ok:true},status=200;
 const failureTarget=refreshFailure?.split(':')[0],failureMode=refreshFailure?.split(':')[1];
 const isRefreshTarget=!refreshFaultInjected&&refreshPending&&(failureTarget==='main'&&String(url).endsWith('/commits/main')||failureTarget==='identity'&&String(url).startsWith('https://identity.example/')||failureTarget==='health'&&String(url).endsWith('/operations-health')||failureTarget==='compare'&&String(url).includes('/compare/'));
 if(isRefreshTarget)refreshFaultInjected=true;
 if(isRefreshTarget&&failureMode==='non-error')throw null;
 if(isRefreshTarget&&failureMode==='timeout')throw Object.assign(Error('private transport details'),{name:'TimeoutError'});
 if(isRefreshTarget&&failureMode==='http')return {ok:false,status:503,json:async()=>({ok:false,error:'private provider details'})};
 if(isRefreshTarget&&failureMode==='json')return {ok:true,status:200,json:async()=>{throw SyntaxError('private malformed response');}};
 if(isRefreshTarget&&failureMode==='malformed')return {ok:true,status:200,json:async()=>failureTarget==='identity'?{value:null}:failureTarget==='main'?{sha:null}:failureTarget==='health'?{ok:true,environment:'production',commit:'malformed'}:{}};
 if(diagnosticFailure==='identity'&&String(url).startsWith('https://identity.example/'))throw Error('PRIVATE_DIAGNOSTIC_ERROR');
 if(String(url).endsWith('/ga4-metrics')&&diagnosticFailure==='transport')throw null;
 if(String(url).endsWith('/ga4-metrics')&&diagnosticFailure==='json')return {ok:true,status:200,json:async()=>{throw SyntaxError('PRIVATE_DIAGNOSTIC_ERROR');}};
 if(String(url).endsWith('/commits/main'))body={sha:moved?'b'.repeat(40):sha};
 else if(String(url).includes('/compare/')){const comparedSha=String(url).split('/compare/')[1].split('...')[0],unsafe=productionDrift==='unsafe'||sourceRace==='unsafe'&&comparedSha==='b'.repeat(40);body={status:'ahead',merge_base_commit:{sha:comparedSha},behind_by:0,files:[{filename:unsafe?'automation/social-queue.json':'automation/reports/cuai-ceo-latest.md',...(productionDrift==='rename'?{previous_filename:'assets/app.js'}:{})}]};}
 else if(String(url).startsWith('https://identity.example/'))body={value:'signed-fixture'};
 else if(String(url).endsWith('/operations-health')){healthCalls++;if(sourceRace&&healthCalls>1)currentProductionSha=sourceRace==='unsafe'||failureTarget==='compare'?'b'.repeat(40):sha;body=healthFailure||(delayedHealth&&healthCalls===1)?{ok:false}:{ok:true,commit:currentProductionSha,environment:'production'};}
 else if(String(url).includes('/contents/automation/social-queue.json')&&options.method!=='PUT')body={sha:'queue-version',content:Buffer.from(JSON.stringify({items:[...(queued?[{...item,...(queueChanged?{copy:'Changed after scheduling'}:{}),...(nativeQueueChanged?{videoUrl:'https://creditunionainews.com/assets/changed-bbbbbbbbbbbb.mp4'}:{})}]:[]),...(reconcile?[scheduled]:[]),{id:'untouched',status:'sent'}]})).toString('base64')};
 else if(String(url).includes('/api/')){assert.equal(options.method,'POST');assert.equal(options.headers.Authorization,'Bearer signed-fixture');const suppliedCommit=JSON.parse(options.body).commitSha;if(sourceRace&&String(url).endsWith('/ga4-metrics')&&suppliedCommit===productionSha){status=403;body={ok:false,error:'deployment_commit_mismatch'};refreshPending=true;}else if(!refreshFailure)assert.equal(suppliedCommit,currentProductionSha);if(metricFailure&&String(url).endsWith('/ga4-metrics'))throw Error('metric retrieval unavailable');if(reconcile&&String(url).endsWith('/buffer-metrics'))body={ok:true,channel:{id:'channel-test'},posts:[{...scheduled,itemId:scheduled.id,sentAt:new Date(Date.now()-30000).toISOString(),externalLink:'https://linkedin.com/posts/fixture',videoAttached:videoSent===true}]};if(queryFixture&&String(url).endsWith('/search-console-metrics'))body={ok:true,windows:{sevenDay:{aggregate:{clicks:2},topPages:[{page:'https://creditunionainews.com/news.html',clicks:2}],topQueries:[{query:'PRIVATE_QUERY_SENTINEL',clicks:2}],topQueryPages:[{query:'PRIVATE_QUERY_SENTINEL',page:'https://creditunionainews.com/news.html',clicks:2}],queryReporting:{queries:{status:'available'}}},twentyEightDay:{topQueries:[{query:'PRIVATE_QUERY_SENTINEL',clicks:3}],topQueryPages:[{query:'PRIVATE_QUERY_SENTINEL',clicks:3}]}}};if(env.CUAI_OPERATION_MODE==='ga4-readonly'&&String(url).endsWith('/ga4-metrics')&&status===200){body={ok:diagnosticFailure!=='http',acquisitionDiagnostic:{dateRanges:[{startDate:env.CUAI_DIAGNOSTIC_START,endDate:env.CUAI_DIAGNOSTIC_END}],...(diagnosticFailure==='unavailable'?{status:'unavailable',error:'PRIVATE_DIAGNOSTIC_ERROR'}:{}),reports:{sourceMedium:{rows:[{sessionSource:'PRIVATE_DIMENSION',sessions:5,engagedSessions:2}],rowCount:1001,returnedRows:1000,truncated:true,rowSums:{sessions:5,engagedSessions:2},providerTotals:[{sessions:4,engagedSessions:2}],evidence:[{rowCount:1001,metadata:{subjectToThresholding:true},providerTotals:[{sessions:4,engagedSessions:2}]}]}}}};if(diagnosticFailure==='http')status=403;if(diagnosticFailure==='missing')delete body.acquisitionDiagnostic;}if(String(url).endsWith('/buffer-schedule-tracked')){if(timeout)throw Error('ambiguous timeout');if(nativeReceipt){status=202;body=nativeReceipt;}else if(!noReceipt)body={ok:true,postId:'buffer-receipt',status:'scheduled'};}}
 return {ok:status<400,status,json:async()=>body};};
 const mutations={reconcileSentQueue:0,recordQueue:0};
 const instrumented=runner.replace('async function reconcileSentQueue(bufferResponse){','async function reconcileSentQueue(bufferResponse){ mutations.reconcileSentQueue++;').replace('async function recordQueue(id,original,result){','async function recordQueue(id,original,result){ mutations.recordQueue++;');
 await vm.runInNewContext(instrumented,{mutations,require:name=>name==='node:fs'?fakeFs:require(name),process:processStub,fetch:fetcher,URL,AbortSignal,Buffer,Date:Clock,setTimeout:(fn,delay)=>{virtualNow+=delay;fn();},console:{log(){},error(){}}});
 return {calls,files,process:processStub,productionSha,mutations};
}
test('workflow verifies current production identity before source or action calls',async()=>{const normal=await runWorkflow();assert.equal(normal.calls.filter(c=>c.url.includes('/api/')).length,4);assert.equal(JSON.parse(normal.files['operation-receipts/run.json']).authentication,'verified');for(const options of [{moved:true},{healthFailure:true}]){const result=await runWorkflow(options);assert.equal(result.calls.some(c=>c.url.endsWith('/buffer-schedule-tracked')),false);assert.equal(result.calls.some(c=>c.url.endsWith('/ga4-metrics')),false);}});
test('verified report-only drift uses the deployed production commit',async()=>{const result=await runWorkflow({productionDrift:'report'});const api=result.calls.filter(c=>c.url.includes('/api/')&&!c.url.endsWith('/operations-health'));assert.ok(api.length>=3);for(const call of api)assert.equal(JSON.parse(call.options.body).commitSha,result.productionSha);const receipt=JSON.parse(result.files['operation-receipts/run.json']);assert.equal(receipt.productionCheck.reportOnlyDrift,true);assert.deepEqual(receipt.productionCheck.driftFiles,['automation/reports/cuai-ceo-latest.md']);});
test('production-facing drift remains blocked',async()=>{const result=await runWorkflow({productionDrift:'unsafe'});assert.equal(result.calls.some(c=>c.url.endsWith('/ga4-metrics')),false);assert.equal(JSON.parse(result.files['operation-receipts/run.json']).status,'failed');assert.equal(result.process.exitCode,1);});
test('report-only drift rejects renames from production-facing paths',async()=>{const result=await runWorkflow({productionDrift:'rename'});assert.equal(result.calls.some(c=>c.url.endsWith('/ga4-metrics')),false);const receipt=JSON.parse(result.files['operation-receipts/run.json']);assert.equal(receipt.status,'failed');assert.equal(receipt.productionCheck.reportOnlyDrift,false);assert.equal(result.process.exitCode,1);});
test('ambiguous scheduling outcome is recorded without a blind retry or queue rewrite',async()=>{const result=await runWorkflow({timeout:true,queued:true});assert.equal(result.calls.filter(c=>c.url.endsWith('/buffer-schedule-tracked')).length,1);assert.equal(result.calls.some(c=>c.options.method==='PUT'),false);assert.equal(JSON.parse(result.files['operation-receipts/run.json']).status,'failed');assert.equal(result.process.exitCode,1);});
test('queue writes require a real receipt and unchanged reserved content',async()=>{const accepted=await runWorkflow({queued:true});const writes=accepted.calls.filter(c=>c.options.method==='PUT');assert.equal(writes.length,1);const put=JSON.parse(writes[0].options.body);assert.equal(put.sha,'queue-version');const updated=JSON.parse(Buffer.from(put.content,'base64').toString());assert.equal(updated.items[0].postId,'buffer-receipt');assert.deepEqual(updated.items[1],{id:'untouched',status:'sent'});for(const option of [{noReceipt:true},{queueChanged:true}]){const result=await runWorkflow({queued:true,...option});assert.equal(result.calls.some(c=>c.options.method==='PUT'),false);assert.equal(result.process.exitCode,1);}});
test('main push waits for matching production before operations',async()=>{const result=await runWorkflow({delayedHealth:true});const api=result.calls.filter(c=>c.url.includes('/api/'));assert.equal(api[0].url.endsWith('/operations-health'),true);assert.equal(api[1].url.endsWith('/operations-health'),true);assert.equal(api[2].url.endsWith('/ga4-metrics'),true);assert.equal(JSON.parse(result.files['operation-receipts/run.json']).authentication,'verified');});
test('source retry refreshes a newly promoted production commit',async()=>{const result=await runWorkflow({sourceRace:'report'});const ga4=result.calls.filter(c=>c.url.endsWith('/ga4-metrics'));assert.equal(ga4.length,2);assert.equal(JSON.parse(ga4[0].options.body).commitSha,'c'.repeat(40));assert.equal(JSON.parse(ga4[1].options.body).commitSha,'a'.repeat(40));const receipt=JSON.parse(result.files['operation-receipts/run.json']);assert.deepEqual(receipt.sourceRetries,[{route:'ga4-metrics',reason:'deployment_commit_mismatch',attempt:1,fromCommit:'c'.repeat(40),toCommit:'a'.repeat(40)}]);assert.equal(receipt.status,'verified');});
test('source retry fails closed when refreshed production changes operational files',async()=>{const result=await runWorkflow({sourceRace:'unsafe'});assert.equal(result.calls.filter(c=>c.url.endsWith('/ga4-metrics')).length,1);assert.equal(result.calls.some(c=>c.url.endsWith('/buffer-schedule-tracked')),false);const receipt=JSON.parse(result.files['operation-receipts/run.json']);assert.equal(receipt.status,'failed');assert.equal(receipt.errors.at(-1).error,'production_identity_refresh_failed');assert.equal(result.process.exitCode,1);});

test('uploaded reporting receipts omit query strings while retaining metrics and availability',async()=>{
 const result=await runWorkflow({queryFixture:true});
 assert.equal(JSON.stringify(result.files).includes('PRIVATE_QUERY_SENTINEL'),false);
 const data=JSON.parse(result.files['operation-receipts/search-console-metrics.json']).data;
 assert.equal(data.windows.sevenDay.aggregate.clicks,2);
 assert.equal(data.windows.sevenDay.topPages[0].clicks,2);
 assert.deepEqual(data.windows.sevenDay.topQueries,[{clicks:2}]);
 assert.equal(data.windows.sevenDay.topQueryPages[0].page,'https://creditunionainews.com/news.html');
 assert.equal(data.windows.twentyEightDay.topQueries[0].clicks,3);
 assert.equal(data.windows.sevenDay.queryReporting.queries.status,'available');
 assert.equal(data.windows.sevenDay.queryTextPersistence,'omitted_from_operation_receipts');
});

// These fixtures can perform real queue writes in the harness. Refresh failure
// must stop both paths even when later metric calls would otherwise succeed.
test('sent-state reconciliation fixture writes its exact existing reservation',async()=>{
 const result=await runWorkflow({queued:true,reconcile:true});
 assert.equal(result.calls.filter(c=>c.options.method==='PUT').length,1);
 assert.equal(result.calls.some(c=>c.url.endsWith('/buffer-schedule-tracked')),false);
 assert.equal(JSON.parse(result.files['operation-receipts/run.json']).reconciliations[0].count,1);
});
for(const target of ['main','identity','health','compare'])for(const mode of ['http','timeout','json','malformed','non-error'])for(const reconcile of [false,true]){
 test(`refresh ${target} ${mode} blocks ${reconcile?'reconciliation':'queued scheduling'}`,async()=>{
  const result=await runWorkflow({sourceRace:'report',refreshFailure:`${target}:${mode}`,queued:true,reconcile});
  assert.equal(result.process.exitCode,1);
  assert.equal(result.calls.some(c=>c.url.endsWith('/buffer-schedule-tracked')),false);
  assert.equal(result.calls.some(c=>c.options.method==='PUT'),false);
  const receipt=JSON.parse(result.files['operation-receipts/run.json']);
  assert.equal(receipt.status,'failed');
  assert.equal(receipt.errors.at(-1).error,'production_identity_refresh_failed');
  assert.equal(JSON.stringify(result.files).includes('private'),false);
 });
}
test('ordinary metric failure stays nonfatal for a verified queued reservation',async()=>{
 const result=await runWorkflow({queued:true,metricFailure:true});
 assert.equal(result.calls.filter(c=>c.url.endsWith('/buffer-schedule-tracked')).length,1);
 assert.equal(result.calls.filter(c=>c.options.method==='PUT').length,1);
 assert.equal(result.process.exitCode,1);
 assert.equal(JSON.parse(result.files['operation-receipts/run.json']).status,'attention');
});

test('native processing and unknown receipts block the same queue item and preserve any provider ID',async()=>{
 for(const postId of ['processing-post',undefined]){const nativeReceipt={ok:false,mediaType:'video',status:'blocked',postId,reconciliationRequired:true,nativeVideoReceiptState:postId?'pending-media':'ambiguous',videoAttached:false,videoUrl:'https://creditunionainews.com/assets/video-aaaaaaaaaaaa.mp4'};const result=await runWorkflow({queued:true,nativeItem:true,nativeReceipt});const writes=result.calls.filter(c=>c.options.method==='PUT');assert.equal(writes.length,1);const data=JSON.parse(Buffer.from(JSON.parse(writes[0].options.body).content,'base64').toString());assert.equal(data.items[0].status,'blocked');assert.equal(data.items[0].postId,postId);assert.equal(data.items[0].nativeVideoReceiptState,nativeReceipt.nativeVideoReceiptState);assert.equal(result.calls.filter(c=>c.url.endsWith('/buffer-schedule-tracked')).length,1);assert.equal(result.process.exitCode,1);assert.deepEqual(data.items[1],{id:'untouched',status:'sent'});}
});
test('an exact sent native-video receipt reconciles an existing blocked item without another schedule request',async()=>{
 const result=await runWorkflow({reconcile:true,videoSent:true});const writes=result.calls.filter(c=>c.options.method==='PUT');assert.equal(writes.length,1);const data=JSON.parse(Buffer.from(JSON.parse(writes[0].options.body).content,'base64').toString());assert.equal(data.items[0].status,'sent');assert.equal(data.items[0].videoAttached,true);assert.equal(data.items[0].reconciliationRequired,false);assert.equal(result.calls.some(c=>c.url.endsWith('/buffer-schedule-tracked')),false);
});

test('native transport loss blocks its reservation without blind retry; changed video identity prevents writing it',async()=>{
 const result=await runWorkflow({queued:true,nativeItem:true,timeout:true});
 const writes=result.calls.filter(c=>c.options.method==='PUT');assert.equal(writes.length,1);
 const data=JSON.parse(Buffer.from(JSON.parse(writes[0].options.body).content,'base64').toString());
 assert.equal(data.items[0].status,'blocked');assert.equal(data.items[0].nativeVideoReceiptState,'ambiguous');assert.equal(data.items[0].postId,undefined);assert.equal(data.items[0].channelId,'6a53df0880cc80cdcaa76fb8');assert.equal(result.calls.filter(c=>c.url.endsWith('/buffer-schedule-tracked')).length,1);
 const changed=await runWorkflow({queued:true,nativeItem:true,nativeQueueChanged:true,timeout:true});assert.equal(changed.calls.some(c=>c.options.method==='PUT'),false);assert.equal(changed.process.exitCode,1);
});
test('a sent image receipt cannot reconcile a blocked native-video reservation',async()=>{
 const result=await runWorkflow({reconcile:true,videoMissingAsset:true});assert.equal(result.calls.some(c=>c.options.method==='PUT'),false);assert.equal(result.calls.some(c=>c.url.endsWith('/buffer-schedule-tracked')),false);
});

test('a native scheduling success must contain a verified video receipt; known IDs survive an incomplete response',async()=>{
 const result=await runWorkflow({queued:true,nativeItem:true});const writes=result.calls.filter(c=>c.options.method==='PUT');assert.equal(writes.length,1);
 const data=JSON.parse(Buffer.from(JSON.parse(writes[0].options.body).content,'base64').toString());assert.equal(data.items[0].status,'blocked');assert.equal(data.items[0].postId,'buffer-receipt');assert.equal(data.items[0].videoAttached,false);assert.equal(result.process.exitCode,1);
});

const diagnosticEnv={GITHUB_EVENT_NAME:'workflow_dispatch',CUAI_OPERATION_MODE:'ga4-readonly',CUAI_DIAGNOSTIC_START:'2026-09-09',CUAI_DIAGNOSTIC_END:'2026-10-06'};
function assertReadOnly(result){
 assert.deepEqual(result.mutations,{reconcileSentQueue:0,recordQueue:0});
 assert.equal(result.calls.some(c=>/buffer-|search-console|social-queue/.test(c.url)),false);
 assert.equal(result.calls.some(c=>['PUT','PATCH','DELETE'].includes(c.options.method)),false);
 const receipt=JSON.parse(result.files['operation-receipts/run.json']);
 assert.deepEqual(receipt.actions,[]);assert.deepEqual(receipt.reconciliations,[]);
 assert.equal(JSON.stringify(result.files).includes('PRIVATE_'),false);
}
test('manual GA4 diagnostic forwards validated dates, retains totals/quality and never invokes mutation functions',async()=>{
 const result=await runWorkflow({env:diagnosticEnv,queued:true,reconcile:true});assertReadOnly(result);
 const calls=result.calls.filter(c=>c.url.endsWith('/ga4-metrics'));assert.equal(calls.length,1);
 assert.deepEqual(JSON.parse(calls[0].options.body),{diagnosticStart:'2026-09-09',diagnosticEnd:'2026-10-06',commitSha:'a'.repeat(40)});
 const report=JSON.parse(result.files['operation-receipts/ga4-metrics.json']).data.acquisitionDiagnostic.reports.sourceMedium;
 assert.equal(report.rows,undefined);assert.equal(report.rowSums.sessions,5);assert.equal(report.providerTotals[0].sessions,4);
 assert.equal(report.truncated,true);assert.equal(report.evidence[0].metadata.subjectToThresholding,true);
 assert.equal(result.process.exitCode,undefined);
});
for(const diagnosticFailure of ['http','transport','json','missing','unavailable','identity'])test(`diagnostic ${diagnosticFailure} exits before all mutations`,async()=>{
 const result=await runWorkflow({env:diagnosticEnv,diagnosticFailure,queued:true,reconcile:true});assertReadOnly(result);assert.equal(result.process.exitCode,1);
});
for(const options of [{healthFailure:true},{moved:true},{productionDrift:'unsafe'},{sourceRace:'unsafe'},...['main','identity','health','compare'].map(target=>({sourceRace:'report',refreshFailure:target+':timeout'}))])test(`diagnostic identity gate ${JSON.stringify(options)} never falls through`,async()=>{
 const result=await runWorkflow({env:diagnosticEnv,queued:true,reconcile:true,...options});assertReadOnly(result);
});
for(const changes of [
 {CUAI_OPERATION_MODE:'typo'},{CUAI_OPERATION_MODE:'operations'},{GITHUB_EVENT_NAME:'schedule'},
 {CUAI_DIAGNOSTIC_START:''},{CUAI_DIAGNOSTIC_END:''},{CUAI_DIAGNOSTIC_START:'2026-02-30'},
 {CUAI_DIAGNOSTIC_START:'2026-09-08'},{CUAI_DIAGNOSTIC_END:'2999-10-08'}
])test(`invalid diagnostic input ${JSON.stringify(changes)} rejects before network or mutation`,async()=>{
 const result=await runWorkflow({env:{...diagnosticEnv,...changes},queued:true,reconcile:true});assertReadOnly(result);
 assert.equal(result.calls.length,0);assert.equal(result.process.exitCode,1);
});
test('diagnostic deployment retry forwards the same dates with refreshed verified commit',async()=>{
 const result=await runWorkflow({env:diagnosticEnv,sourceRace:'report',queued:true,reconcile:true});assertReadOnly(result);
 const calls=result.calls.filter(c=>c.url.endsWith('/ga4-metrics'));assert.equal(calls.length,2);
 calls.forEach(c=>assert.equal(JSON.parse(c.options.body).diagnosticStart,diagnosticEnv.CUAI_DIAGNOSTIC_START));
 assert.equal(JSON.parse(calls[1].options.body).commitSha,'a'.repeat(40));
});
test('workflow passes manual inputs only as environment data and retains its existing schedule and permissions',()=>{
 const workflow=fs.readFileSync(require('node:path').join(__dirname,'../.github/workflows/cuai-operations.yml'),'utf8');
 assert.match(workflow,/options: \[operations, ga4-readonly\]/);assert.match(workflow,/default: operations/);
 for(const input of ['mode','diagnosticStart','diagnosticEnd'])assert.ok(workflow.includes('${{ inputs.'+input+' }}'));
 assert.match(workflow,/run: node scripts\/run-secure-operations.cjs/);
 assert.match(workflow,/cron: '45 17 \* \* 1-5'/);
 assert.match(workflow,/contents: write\n      id-token: write/);
});
