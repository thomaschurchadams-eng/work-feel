const fs=require('node:fs');
const REPO='thomaschurchadams-eng/work-feel';
const API='https://api.github.com/repos/'+REPO;
const SITE='https://creditunionainews.com';
const headers={Authorization:'Bearer '+process.env.GITHUB_TOKEN,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'};
const receipts={startedAt:new Date().toISOString(),commit:process.env.DEPLOYED_SHA,authentication:'unverified',actions:[],sourceRetries:[],errors:[]};
fs.mkdirSync('operation-receipts',{recursive:true});
const save=()=>fs.writeFileSync('operation-receipts/run.json',JSON.stringify(receipts,null,2)+'\n');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function github(path,options={}){const response=await fetch(API+path,{...options,headers:{...headers,...options.headers},signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error('github_'+response.status);return response.json();}
async function identity(){const url=new URL(process.env.ACTIONS_ID_TOKEN_REQUEST_URL);url.searchParams.set('audience',SITE+'/operations');const response=await fetch(url,{headers:{Authorization:'Bearer '+process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN},signal:AbortSignal.timeout(10000)});if(!response.ok)throw Error('identity_'+response.status);const data=await response.json();if(typeof data.value!=='string')throw Error('identity_missing');console.log('::add-mask::'+data.value);return data.value;}
async function invoke(route,payload){const token=await identity();const response=await fetch(SITE+'/api/'+route,{method:'POST',redirect:'error',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({...payload,commitSha:process.env.DEPLOYED_SHA}),signal:AbortSignal.timeout(25000)});const data=await response.json();return {status:response.status,data};}
async function readSource(route){
 let response;
 for(let attempt=1;attempt<=3;attempt++){
  response=await invoke(route,{});
  const deploymentRace=response.status===403&&response.data?.error==='deployment_commit_mismatch';
  if(!deploymentRace||attempt===3)return response;
  receipts.sourceRetries.push({route,reason:'deployment_commit_mismatch',attempt});save();
  await sleep(5000);
 }
 return response;
}
async function recordQueue(id,original,result){
 const latest=await github('/contents/automation/social-queue.json?ref=main');const queue=JSON.parse(Buffer.from(latest.content,'base64').toString());const item=queue.items.find(x=>x.id===id);
 if(!item||['articleUrl','distributionUrl','copy','scheduledFor','imageUrl','imageAlt'].some(key=>item[key]!==original[key]))throw Error('queue_changed_reconcile_receipt');
 if(!['queued','scheduled','sent'].includes(item.status))throw Error('queue_status_changed');
 if(item.postId&&item.postId!==result.postId)throw Error('different_post_receipt_reconcile');
 Object.assign(item,{status:result.status||'scheduled',postId:result.postId,channelId:result.channelId,channelName:result.channelName,scheduledAt:new Date().toISOString(),bufferDueAt:result.dueAt,lastAttemptAt:new Date().toISOString(),lastResult:'verified secure workflow receipt',duplicate:!!result.duplicate,imageAttached:result.imageAttached});
 await github('/contents/automation/social-queue.json',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:'Record verified CUAI distribution receipt',sha:latest.sha,branch:'main',content:Buffer.from(JSON.stringify(queue,null,2)+'\n').toString('base64')})});
}
(async()=>{
 if(!/^[a-f0-9]{40}$/.test(process.env.DEPLOYED_SHA||''))throw Error('invalid_deployment_sha');
 const current=await github('/commits/main');if(current.sha!==process.env.DEPLOYED_SHA){receipts.status='superseded';save();console.log('A newer main commit exists; its production deployment owns the next run.');return;}
 // Main pushes can precede Vercel promotion. Poll only the authenticated,
 // read-only health check for at most three minutes; operations remain gated.
 const deadline=Date.now()+180000;let productionReady=false;
 do {
  const latest=await github('/commits/main');
  if(latest.sha!==process.env.DEPLOYED_SHA){receipts.status='superseded';save();return;}
  try {
   const health=await invoke('operations-health',{});
   receipts.productionCheck={status:health.status,commit:health.data.commit,environment:health.data.environment,error:health.data.error};
   productionReady=health.status===200&&health.data.ok===true&&health.data.commit===process.env.DEPLOYED_SHA&&health.data.environment==='production';
  }catch(error){receipts.productionCheck={error:error.message};}
  if(productionReady)break;
  if(Date.now()>=deadline)break;
  await sleep(5000);
 }while(Date.now()<deadline);
 if(!productionReady)throw Error('production_identity_check_failed');
 receipts.authentication='verified';save();
 // Metrics are read-only. Vercel route propagation can briefly lag the verified
 // production health check, so retry only the exact deployment-mismatch case.
 // Other source failures remain visible immediately and never become zero data.
 for(const route of ['ga4-metrics','search-console-metrics','buffer-metrics']){try{const response=await readSource(route);fs.writeFileSync('operation-receipts/'+route+'.json',JSON.stringify(response,null,2)+'\n');if(response.status>=400||!response.data.ok)receipts.errors.push({route,error:response.data.error||'source_failed'});}catch(error){receipts.errors.push({route,error:error.message});}}
 const queue=JSON.parse(fs.readFileSync('automation/social-queue.json','utf8'));
 const candidates=queue.items.filter(x=>x.status==='queued'&&Date.parse(x.scheduledFor)>Date.now()+5*60000).sort((a,b)=>Date.parse(a.scheduledFor)-Date.parse(b.scheduledFor));
 // Process one reserved item per run. Existing endpoint validates channel,
 // quality, tracking, live article/image, fixed time and duplicate/day limits.
 if(candidates.length){const item=candidates[0];const result=await invoke('buffer-schedule-tracked',{itemId:item.id});receipts.actions.push({itemId:item.id,...result});save();if([200,201].includes(result.status)&&result.data.ok&&typeof result.data.postId==='string'&&result.data.postId.length>0){await recordQueue(item.id,item,result.data);}else receipts.errors.push({route:'buffer-schedule-tracked',error:result.data.error||'schedule_receipt_missing'});}
 receipts.completedAt=new Date().toISOString();receipts.status=receipts.errors.length?'attention':'verified';save();
 console.log('Production identity verified; '+receipts.actions.length+' distribution attempts; '+receipts.errors.length+' source/action exceptions.');
 if(receipts.errors.length)process.exitCode=1;
})().catch(error=>{receipts.errors.push({error:error.message});receipts.status='failed';save();console.error(error.message);process.exitCode=1;});
