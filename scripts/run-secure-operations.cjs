const fs=require('node:fs');
const {closedRange}=require('../lib/ga4-acquisition-diagnostic');
const MEDIA_POLICY=require('../automation/media-policy.json');
const REPO='thomaschurchadams-eng/work-feel';
const API='https://api.github.com/repos/'+REPO;
const SITE='https://creditunionainews.com';
const REPORT_ONLY_FILES=new Set(['automation/reports/cuai-ceo-latest.md','automation/cuai-usage-ledger.json']);
const headers={Authorization:'Bearer '+process.env.GITHUB_TOKEN,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'};
const receipts={startedAt:new Date().toISOString(),commit:process.env.DEPLOYED_SHA,authentication:'unverified',actions:[],reconciliations:[],sourceRetries:[],errors:[]};
let operationCommit=process.env.DEPLOYED_SHA;
fs.mkdirSync('operation-receipts',{recursive:true});
const save=()=>fs.writeFileSync('operation-receipts/run.json',JSON.stringify(receipts,null,2)+'\n');
// Uploaded receipts have a broader repository audience than the reporting identity.
// Keep query strings in the authorized response only, never in persisted artifacts.
function receiptResponse(route,response){
 if(route!=='search-console-metrics')return response;
 const sanitized=JSON.parse(JSON.stringify(response));
 for(const window of Object.values(sanitized.data?.windows||{})){
  for(const key of ['topQueries','topQueryPages']){
   if(Array.isArray(window[key]))window[key]=window[key].map(({query,...metrics})=>metrics);
  }
  window.queryTextPersistence='omitted_from_operation_receipts';
 }
 return sanitized;
}
// Diagnostic artifacts contain aggregate metrics/quality evidence, not raw
// source, medium, campaign or other dimension strings from provider responses.
function diagnosticReceipt(response){
 const data=response.data||{};
 const diagnostic=data.acquisitionDiagnostic;
 const metrics=row=>({sessions:Number(row?.sessions)||0,engagedSessions:Number(row?.engagedSessions)||0});
 const reports={};
 for(const name of ['overview','sourceMedium','sourceMediumCampaign']){
  const report=diagnostic?.reports?.[name];
  if(!report)continue;
  reports[name]={rowCount:report.rowCount,returnedRows:report.returnedRows,truncated:report.truncated,
   rowSums:metrics(report.rowSums),providerTotals:(report.providerTotals||[]).map(metrics),
   evidence:(report.evidence||[]).map(page=>({rowCount:page.rowCount,metadata:page.metadata,providerTotals:(page.providerTotals||[]).map(metrics)}))};
 }
 return {status:response.status,data:{ok:data.ok===true,
  acquisitionDiagnostic:diagnostic?{dateRanges:diagnostic.dateRanges,status:diagnostic.status,
   ...(diagnostic.status==='unavailable'?{error:'ga4_diagnostic_unavailable'}:{}),
   reports,limits:diagnostic.limits,generatedAt:diagnostic.generatedAt}:undefined,
  dimensionTextPersistence:'omitted_from_operation_receipts'}};
}
function runMode(){
 const mode=process.env.CUAI_OPERATION_MODE||'operations';
 const diagnosticStart=process.env.CUAI_DIAGNOSTIC_START||'',diagnosticEnd=process.env.CUAI_DIAGNOSTIC_END||'';
 if(!['operations','ga4-readonly'].includes(mode))throw Error('invalid_operation_mode');
 if(mode==='operations'){
  if(diagnosticStart||diagnosticEnd)throw Error('unexpected_diagnostic_dates');
  return {mode,payload:{}};
 }
 if(process.env.GITHUB_EVENT_NAME!=='workflow_dispatch')throw Error('diagnostic_requires_manual_dispatch');
 closedRange(diagnosticStart,diagnosticEnd);
 return {mode,payload:{diagnosticStart,diagnosticEnd}};
}
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function github(path,options={}){const response=await fetch(API+path,{...options,headers:{...headers,...options.headers},signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error('github_'+response.status);return response.json();}
async function identity(){const url=new URL(process.env.ACTIONS_ID_TOKEN_REQUEST_URL);url.searchParams.set('audience',SITE+'/operations');const response=await fetch(url,{headers:{Authorization:'Bearer '+process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN},signal:AbortSignal.timeout(10000)});if(!response.ok)throw Error('identity_'+response.status);const data=await response.json();if(typeof data.value!=='string')throw Error('identity_missing');console.log('::add-mask::'+data.value);return data.value;}
async function invoke(route,payload,nativeVideo=null){
 const token=await identity(); // An identity failure occurs before any distribution request.
 const unknown=(known={})=>({status:202,data:{ok:false,postId:typeof known.postId==='string'&&known.postId.length?known.postId:undefined,providerStatus:known.providerStatus,mediaType:'video',status:'blocked',channelId:MEDIA_POLICY.distribution.channelId,channelName:MEDIA_POLICY.distribution.channelName,dueAt:nativeVideo.scheduledFor,videoUrl:nativeVideo.videoUrl,videoAttached:false,nativeVideoReceiptState:'ambiguous',reconciliationRequired:true,error:'native_video_request_outcome_unknown'}});
 try{
  const response=await fetch(SITE+'/api/'+route,{method:'POST',redirect:'error',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({...payload,commitSha:operationCommit}),signal:AbortSignal.timeout(25000)});
  const data=await response.json();
  if(nativeVideo&&(response.status>=500||([200,201].includes(response.status)&&!(data?.ok===true&&data.mediaType==='video'&&data.videoAttached===true&&typeof data.postId==='string'&&data.postId.length>0))))return unknown(data);
  return {status:response.status,data};
 }catch(error){if(nativeVideo)return unknown();throw error;}
}
async function reportOnlyDrift(productionSha,runSha){
 if(productionSha===runSha)return {allowed:true,files:[]};
 if(!/^[a-f0-9]{40}$/.test(productionSha||''))return {allowed:false,files:[]};
 const comparison=await github('/compare/'+productionSha+'...'+runSha);
 const changedFiles=Array.isArray(comparison.files)?comparison.files:[];
 const files=changedFiles.map(file=>file.filename);
 const ancestor=comparison.status==='ahead'&&comparison.merge_base_commit?.sha===productionSha&&comparison.behind_by===0;
 const reportOnly=changedFiles.every(file=>REPORT_ONLY_FILES.has(file.filename)&&!file.previous_filename);
 return {allowed:ancestor&&files.length>0&&files.length<300&&reportOnly,files};
}
class ProductionIdentityRefreshError extends Error {
 constructor(message='production_identity_refresh_failed'){super(message);this.name='ProductionIdentityRefreshError';this.code='production_identity_refresh_failed';}
}
async function readSource(route,payload={}){
 let response;
 for(let attempt=1;attempt<=3;attempt++){
  response=await invoke(route,payload);
  const deploymentRace=response.status===403&&response.data?.error==='deployment_commit_mismatch';
  if(!deploymentRace||attempt===3)return response;
  try {
  const previousCommit=operationCommit;
  const current=await github('/commits/main');
  if(!/^[a-f0-9]{40}$/.test(current?.sha||''))throw Error('production_identity_refresh_failed');
  if(current.sha!==process.env.DEPLOYED_SHA)throw Error('main_changed_during_source_retry');
  const health=await invoke('operations-health',{});
  const drift=health.status===200&&health.data?.ok===true?await reportOnlyDrift(health.data.commit,process.env.DEPLOYED_SHA):{allowed:false,files:[]};
  const refreshed=health.status===200&&health.data.ok===true&&health.data.environment==='production'&&drift.allowed;
  if(!refreshed)throw Error('production_identity_refresh_failed');
  operationCommit=health.data.commit;
  receipts.sourceRetries.push({route,reason:'deployment_commit_mismatch',attempt,fromCommit:previousCommit,toCommit:operationCommit});save();
  await sleep(5000);
  }catch(error){
   // Every refresh failure invalidates action authorization, including transport,
   // JSON and malformed identity errors. Do not persist raw provider error text.
   throw new ProductionIdentityRefreshError(error?.message==='main_changed_during_source_retry'?error.message:undefined);
  }
 }
 return response;
}
async function recordQueue(id,original,result){
 const latest=await github('/contents/automation/social-queue.json?ref=main');const queue=JSON.parse(Buffer.from(latest.content,'base64').toString());const item=queue.items.find(x=>x.id===id);
 if(!item||['articleUrl','distributionUrl','copy','scheduledFor','imageUrl','imageAlt','mediaType','mediaAssetId','mediaFormat','parentPublicationId','videoUrl','videoSha256'].some(key=>item[key]!==original[key]))throw Error('queue_changed_reconcile_receipt');
 if(!['queued','scheduled','sent'].includes(item.status))throw Error('queue_status_changed');
 if(item.postId&&item.postId!==result.postId)throw Error('different_post_receipt_reconcile');
 Object.assign(item,{status:result.status||'scheduled',postId:result.postId,channelId:result.channelId,channelName:result.channelName,scheduledAt:new Date().toISOString(),bufferDueAt:result.dueAt,lastAttemptAt:new Date().toISOString(),lastResult:result.reconciliationRequired?'provider receipt requires reconciliation':'verified secure workflow receipt',duplicate:!!result.duplicate,imageAttached:result.imageAttached});
 if(result.mediaType==='video')Object.assign(item,{mediaType:'video',videoAttached:result.videoAttached,videoUrl:result.videoUrl,videoMimeType:result.videoMimeType,providerStatus:result.providerStatus,nativeVideoReceiptState:result.nativeVideoReceiptState,reconciliationRequired:result.reconciliationRequired});
 await github('/contents/automation/social-queue.json',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:result.reconciliationRequired?'Record unresolved CUAI native video receipt':'Record verified CUAI distribution receipt',sha:latest.sha,branch:'main',content:Buffer.from(JSON.stringify(queue,null,2)+'\n').toString('base64')})});
}
async function reconcileSentQueue(bufferResponse){
 if(bufferResponse?.status!==200||bufferResponse.data?.ok!==true||!Array.isArray(bufferResponse.data.posts))return 0;
 const channel=bufferResponse.data.channel||{};
 const sentPosts=new Map(bufferResponse.data.posts.filter(post=>typeof post.itemId==='string'&&typeof post.postId==='string'&&typeof post.sentAt==='string'&&typeof post.externalLink==='string').map(post=>[post.itemId,post]));
 if(!sentPosts.size)return 0;
 const latest=await github('/contents/automation/social-queue.json?ref=main');const queue=JSON.parse(Buffer.from(latest.content,'base64').toString());let changed=0;
 for(const item of queue.items){
  if(!(item.status==='scheduled'||(item.status==='blocked'&&item.mediaType==='video'&&item.reconciliationRequired===true))||typeof item.postId!=='string'||Date.parse(item.scheduledFor)>Date.now())continue;
  const post=sentPosts.get(item.id);if(!post||post.postId!==item.postId)continue;
  if(post.articleUrl!==item.articleUrl||post.distributionUrl!==item.distributionUrl||post.scheduledFor!==item.scheduledFor)continue;
  if(item.mediaType==='video'&&post.videoAttached!==true)continue;
  if(channel.id&&item.channelId!==channel.id)continue;
  if(channel.name&&item.channelName!==channel.name)continue;
  Object.assign(item,{status:'sent',sentAt:post.sentAt,externalLink:post.externalLink});if(item.mediaType==='video')Object.assign(item,{nativeVideoReceiptState:'sent',videoAttached:true,reconciliationRequired:false});changed++;
 }
 if(!changed)return 0;
 const current=await github('/commits/main');if(current.sha!==process.env.DEPLOYED_SHA)throw Error('main_changed_before_sent_reconcile');
 await github('/contents/automation/social-queue.json',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:'Reconcile verified CUAI LinkedIn sent state',sha:latest.sha,branch:'main',content:Buffer.from(JSON.stringify(queue,null,2)+'\n').toString('base64')})});
 receipts.reconciliations.push({type:'buffer-sent-state',count:changed});save();
 return changed;
}
(async()=>{
 const configuration=runMode();
 receipts.mode=configuration.mode;
 if(!/^[a-f0-9]{40}$/.test(process.env.DEPLOYED_SHA||''))throw Error('invalid_deployment_sha');
 const current=await github('/commits/main');if(current.sha!==process.env.DEPLOYED_SHA){receipts.status='superseded';save();console.log('A newer main commit exists; its production deployment owns the next run.');return;}
 // Main pushes can precede Vercel promotion. A report-only commit may also be
 // intentionally skipped by Vercel, so allow only the two canonical reporting
 // files to drift while all production-facing repository state remains exact.
 const deadline=Date.now()+180000;let productionReady=false;
 do {
  const latest=await github('/commits/main');
  if(latest.sha!==process.env.DEPLOYED_SHA){receipts.status='superseded';save();return;}
  try {
   const health=await invoke('operations-health',{});
   const drift=health.status===200&&health.data?.ok===true?await reportOnlyDrift(health.data.commit,process.env.DEPLOYED_SHA):{allowed:false,files:[]};
   receipts.productionCheck={status:health.status,commit:health.data.commit,runCommit:process.env.DEPLOYED_SHA,environment:health.data.environment,error:configuration.mode==='ga4-readonly'?(health.data.error?'production_identity_check_failed':undefined):health.data.error,reportOnlyDrift:drift.allowed,driftFiles:drift.files};
   productionReady=health.status===200&&health.data.ok===true&&health.data.environment==='production'&&drift.allowed;
   if(productionReady)operationCommit=health.data.commit;
  }catch(error){receipts.productionCheck={error:configuration.mode==='ga4-readonly'?'production_identity_check_failed':error.message};}
  if(productionReady)break;
  if(Date.now()>=deadline)break;
  await sleep(5000);
 }while(Date.now()<deadline);
 if(!productionReady)throw Error('production_identity_check_failed');
 receipts.authentication='verified';save();
 if(configuration.mode==='ga4-readonly'){
  // This branch ends the run on success, unavailable data or any exception.
  // Never fall through to other sources, reconciliation, scheduling or writes.
  try{
   const response=await readSource('ga4-metrics',configuration.payload);
   fs.writeFileSync('operation-receipts/ga4-metrics.json',JSON.stringify(diagnosticReceipt(response),null,2)+'\n');
   if(response.status!==200||response.data?.ok!==true||!response.data?.acquisitionDiagnostic||response.data.acquisitionDiagnostic.status==='unavailable')receipts.errors.push({route:'ga4-metrics',error:'ga4_diagnostic_unavailable'});
  }catch(error){receipts.errors.push({route:'ga4-metrics',error:error instanceof ProductionIdentityRefreshError?'production_identity_refresh_failed':'ga4_diagnostic_request_failed'});}
  receipts.completedAt=new Date().toISOString();receipts.status=receipts.errors.length?'attention':'verified';save();
  if(receipts.errors.length)process.exitCode=1;
  return;
 }
 // Metrics are read-only. Vercel route propagation can briefly lag the verified
 // production health check, so retry only the exact deployment-mismatch case.
 // Other source failures remain visible immediately and never become zero data.
 let bufferMetrics=null;
 for(const route of ['ga4-metrics','search-console-metrics','buffer-metrics']){try{const response=await readSource(route);fs.writeFileSync('operation-receipts/'+route+'.json',JSON.stringify(receiptResponse(route,response),null,2)+'\n');if(route==='buffer-metrics')bufferMetrics=response;if(response.status>=400||!response.data.ok)receipts.errors.push({route,error:response.data.error||'source_failed'});}catch(error){if(error instanceof ProductionIdentityRefreshError)throw error;receipts.errors.push({route,error:error.message});}}
 // Buffer is authoritative for sent state. Reconcile only an exact existing
 // scheduled item after its fixed due time, with matching immutable URLs,
 // reservation, channel and post id. A reconciliation commit ends this run;
 // the resulting main push owns any later queued scheduling work.
 const reconciled=await reconcileSentQueue(bufferMetrics);
 if(reconciled){receipts.completedAt=new Date().toISOString();receipts.status=receipts.errors.length?'attention':'verified';save();console.log('Production identity verified; 0 distribution attempts; '+reconciled+' sent-state reconciliations; '+receipts.errors.length+' source/action exceptions.');if(receipts.errors.length)process.exitCode=1;return;}
 const queue=JSON.parse(fs.readFileSync('automation/social-queue.json','utf8'));
 const candidates=queue.items.filter(x=>x.status==='queued'&&Date.parse(x.scheduledFor)>Date.now()+5*60000).sort((a,b)=>Date.parse(a.scheduledFor)-Date.parse(b.scheduledFor));
 // Process one reserved item per run. Existing endpoint validates channel,
 // quality, tracking, live article/image, fixed time and duplicate/day limits.
 if(candidates.length){const item=candidates[0];const result=await invoke('buffer-schedule-tracked',{itemId:item.id},item.mediaType==='video'?item:null);receipts.actions.push({itemId:item.id,...result});save();if(([200,201].includes(result.status)&&result.data.ok&&typeof result.data.postId==='string'&&result.data.postId.length>0)||(result.status===202&&result.data.mediaType==='video'&&result.data.reconciliationRequired===true&&result.data.status==='blocked')){await recordQueue(item.id,item,result.data);if(result.data.reconciliationRequired)receipts.errors.push({route:'buffer-schedule-tracked',error:'native_video_receipt_requires_reconciliation',postId:result.data.postId});}else receipts.errors.push({route:'buffer-schedule-tracked',error:result.data.error||'schedule_receipt_missing'});}
 receipts.completedAt=new Date().toISOString();receipts.status=receipts.errors.length?'attention':'verified';save();
 console.log('Production identity verified; '+receipts.actions.length+' distribution attempts; '+receipts.errors.length+' source/action exceptions.');
 if(receipts.errors.length)process.exitCode=1;
})().catch(error=>{const message=process.env.CUAI_OPERATION_MODE==='ga4-readonly'?'ga4_readonly_run_failed':error.message;receipts.errors.push({error:message});receipts.status='failed';save();console.error(message);process.exitCode=1;});
