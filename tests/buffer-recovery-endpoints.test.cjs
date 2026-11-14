const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const slots = require('../lib/media-slots.cjs');
const guard = require('../lib/buffer-reservation-guard.cjs');
const policy = require('../automation/media-policy.json');
const NOW = Date.parse('2026-11-13T13:00:00Z'), SHA = 'a'.repeat(40);
const channel = { id:policy.distribution.channelId, service:'linkedin', displayName:'CreditUnionAI News', isQueuePaused:false };
const url = id => 'https://creditunionainews.com/news/' + id + '.html';
const queued = (id, at, extra={}) => ({id,platform:'linkedin',contentKind:'article',status:'queued',articleUrl:url(id),distributionUrl:url(id),copy:'A concrete useful credit union decision '+url(id),scheduledFor:at,...extra});
const provider = (id, at, extra={}) => ({id,text:url(id),status:'scheduled',channelId:channel.id,dueAt:at,sentAt:null,metadata:null,...extra});
const first = '2026-11-16T12:30:00-05:00', second = first;
const article = id => ({id,canonicalUrl:url(id),eligible:true,classification:'Standard',productionVerified:true,publishedAt:'2026-11-12T12:00:00Z'});

function endpoint(name,{item=queued('candidate',second),others=[],posts=[],authorized=true,head=SHA,truncated=false,malformed=false,pageMissing=false,queuePaused=false,initialNow=NOW,advanceDuringInventory=0,live=true,articleHtml,mutationFailure=false,missingAsset=false,missingReceipt=false}={}){
  const calls=[],module={exports:{}};let now=initialNow;
  const queue={items:[item,...others]},before=JSON.stringify(queue);
  class Clock extends Date {static now(){return now;}}
  vm.runInNewContext(fs.readFileSync('api/'+name+'.js','utf8'),{module,URL,Date:Clock,Intl,Set,AbortSignal,process:{cwd:()=>'/fixture',env:{BUFFER_API_KEY:'fixture-only',VERCEL_GIT_COMMIT_SHA:SHA}},require:p=>{
    if(p.endsWith('operations-auth'))return{authorize:async()=>authorized};
    if(p==='node:fs')return{readFileSync:()=>JSON.stringify(queue)};
    if(p==='node:path')return path;
    if(p.endsWith('media-policy.json'))return policy;
    if(p.endsWith('media-slots.cjs'))return{...slots,validateSchedule:(at,it)=>slots.validateSchedule(at,it,policy,now)};
    if(p.endsWith('buffer-reservation-guard.cjs'))return{verifyReservation:args=>guard.verifyReservation(args,()=>now)};
    if(p.endsWith('native-video.cjs'))return require('../lib/native-video.cjs');
    throw Error('Unexpected dependency '+p);
  },fetch:async(raw,options)=>{
    const u=String(raw),b=options?.body?JSON.parse(options.body):null;calls.push({url:u,body:b});
    if(u!=='https://api.buffer.com')return{ok:live,status:live?200:404,url:u,headers:{get:()=>u.includes('/assets/')?'image/png':'text/html'},text:async()=>articleHtml||'<meta property="og:image" content="https://creditunionainews.com/assets/fixture.png">',arrayBuffer:async()=>new Uint8Array([1,2,3]).buffer};
    let data;
    if(b.query.includes('createPost')&&mutationFailure)throw Error('fixture timeout after submission');
    if(b.query.includes('createPost'))data={createPost:{post:{id:'new-receipt',status:'scheduled',dueAt:item.scheduledFor,assets:[{mimeType:'image/png'}],metadata:{linkAttachment:{url:item.articleUrl}}}}};
    else if(b.query.includes('channels('))data={channels:[{...channel,isQueuePaused:queuePaused}]};
    else if(b.query.includes('posts(')){
      const inventory=b.query.includes('BufferReservationInventory');
      if(inventory)now+=advanceDuringInventory;
      const start=inventory&&b.variables.after?100:0;
      const more=truncated||posts.length>start+100;
      data={posts:{edges:posts.slice(start,start+100).map(node=>({node})),pageInfo:{hasNextPage:more,endCursor:more?'cursor-100':null}}};
      if(inventory&&malformed)data.posts.edges=[{node:{id:'invalid'}}];
      if(inventory&&pageMissing)delete data.posts.pageInfo;
    } else data={account:{organizations:[{id:'organization'}]}};
    if(b.query.includes('createPost')&&missingAsset){data.createPost.post.assets=[];data.createPost.post.metadata=null;}
    if(b.query.includes('createPost')&&missingReceipt)data.createPost={};
    return{ok:true,status:200,json:async()=>({data})};
  }});
  const res={setHeader(){},status(code){this.statusCode=code;return this},json(body){this.body=body;return this}};
  return{async run(){await module.exports({method:'POST',body:{itemId:item.id,commitSha:head}},res);assert.equal(JSON.stringify(queue),before);},res,calls,mutations:()=>calls.filter(c=>c.body?.query?.includes('createPost'))};
}
for(const name of ['buffer-schedule','buffer-schedule-image']){
 test(name+' enforces recovery proof even when the actual reader has no review flags',async t=>{
  const {idDigest,sha256}=require('../lib/buffer-history-exclusion.cjs');
  const {readInventory}=require('../lib/buffer-inventory.cjs');
  const original=policy.distribution.reviewedEventExclusions;
  const proof=structuredClone(original[0]),html='<meta property="og:image" content="https://creditunionainews.com/assets/fixture.png"><article>Exact reviewed fixture</article>';
  proof.articleSha256=sha256(html);
  const posts=Array.from({length:78},(_,i)=>provider('historic-'+i,null,{status:'sent',sentAt:i===77?proof.history.latestSentAt:'2026-10-01T12:00:00Z',text:url('different-historic-'+i)}));
  proof.history.idSetSha256=idDigest(posts);
  const tracked=new URL(proof.canonicalUrl);tracked.search=new URLSearchParams({utm_source:'linkedin',utm_medium:'organic_social',utm_campaign:'cuai_news',utm_content:proof.candidateId});
  const item=queued(proof.candidateId,second,{articleUrl:proof.canonicalUrl,distributionUrl:tracked.toString(),eventId:proof.eventId,parentPublicationId:proof.parentPublicationId,copy:proof.copyLead+' '+tracked});
  const config={item,posts,articleHtml:html,initialNow:Date.parse('2026-11-14T00:30:00Z')};
  policy.distribution.reviewedEventExclusions=[proof];
  try{
   const cases=[
    ['valid proof',{},null],
    ['changed historical snapshot',{posts:posts.map((p,i)=>i===0?{...p,id:'different-history-id'}:p)},'historical_exclusion_snapshot_changed'],
    ['new recognized active record',{posts:[...posts,provider('new-active',first)]},'historical_exclusion_snapshot_changed'],
    ['expired proof and changed article',{initialNow:Date.parse('2026-11-17T00:30:00Z'),item:{...item,scheduledFor:'2026-11-18T11:30:00-05:00'},articleHtml:html+'changed'},'historical_exclusion_proof_invalid'],
    ['changed article alone',{articleHtml:html+'changed'},'historical_exclusion_candidate_mismatch'],
    ['expired proof alone',{initialNow:Date.parse('2026-11-17T00:30:00Z'),item:{...item,scheduledFor:'2026-11-18T11:30:00-05:00'}},'historical_exclusion_proof_invalid'],
    ['changed reservation ID cannot evade proof',{item:{...item,id:'renamed-recovery'}},'buffer_reservation_inventory_requires_review'],
    ['changed URL and ID retain event proof requirement',{item:{...item,id:'syndicated-recovery',articleUrl:url('syndicated'),distributionUrl:url('syndicated'),copy:'Renamed story '+url('syndicated')}},'buffer_reservation_inventory_requires_review'],
    ['encoded path with renamed ID and stripped identity cannot evade proof',{item:{...item,id:'encoded-alias',eventId:undefined,parentPublicationId:undefined,articleUrl:proof.canonicalUrl.replace('/heloc-','/%68eloc-'),distributionUrl:proof.canonicalUrl.replace('/heloc-','/%68eloc-'),copy:'Encoded alias '+proof.canonicalUrl.replace('/heloc-','/%68eloc-')}},'queue_reservation_invalid']
   ];
   for(const [label,change,error] of cases)await t.test(label,async()=>{
    const opts={...config,...change},before=JSON.stringify(opts.posts);
    const inventory=await readInventory(async()=>({posts:{edges:opts.posts.map(node=>({node})),pageInfo:{hasNextPage:false,endCursor:null}}}),{organizationId:'organization',channel,commitSha:SHA},()=>opts.initialNow);
    assert.equal(inventory.complete,true);assert.equal(inventory.requiresReview,false);assert.ok(inventory.records.every(p=>p.requiresReview===false));
    const f=endpoint(name,opts);await f.run();
    if(error){assert.equal(f.res.body.error,error);assert.equal(f.mutations().length,0);}
    else{assert.equal(f.res.statusCode,201,JSON.stringify(f.res.body));assert.equal(f.mutations().length,1);}
    assert.equal(JSON.stringify(opts.posts),before);
   });
  }finally{policy.distribution.reviewedEventExclusions=original;}
 });
 test(name+' actual reader permits only reviewed new-event exclusion and preserves every historical flag',async()=>{
  const {idDigest,sha256}=require('../lib/buffer-history-exclusion.cjs');
  const original=policy.distribution.reviewedEventExclusions;
  const proof=structuredClone(original[0]),html='<meta property="og:image" content="https://creditunionainews.com/assets/fixture.png"><article>Exact reviewed fixture</article>';
  proof.articleSha256=sha256(html);
  const posts=Array.from({length:78},(_,i)=>provider('historic-'+i,null,{status:'sent',sentAt:i===77?proof.history.latestSentAt:'2026-10-01T12:00:00Z',text:'https://foreign.example/unresolved-'+i}));
  proof.history.idSetSha256=idDigest(posts);
  const tracked=new URL(proof.canonicalUrl);tracked.search=new URLSearchParams({utm_source:'linkedin',utm_medium:'organic_social',utm_campaign:'cuai_news',utm_content:proof.candidateId});
  const item=queued(proof.candidateId,second,{articleUrl:proof.canonicalUrl,distributionUrl:tracked.toString(),eventId:proof.eventId,parentPublicationId:proof.parentPublicationId,copy:proof.copyLead+' '+tracked});
  const before=JSON.stringify(posts),config={item,posts,articleHtml:html,initialNow:Date.parse('2026-11-14T00:30:00Z')};
  policy.distribution.reviewedEventExclusions=[proof];
  try{
   const accepted=endpoint(name,config);await accepted.run();assert.equal(accepted.res.statusCode,201,JSON.stringify(accepted.res.body));assert.equal(accepted.mutations().length,1);assert.equal(JSON.stringify(posts),before);
   for(const change of [{articleHtml:html+'changed'},{posts:[...posts,provider('active',first,{text:'https://buff.ly/opaque'})]},{posts:posts.map((p,i)=>i===0?{...p,text:item.articleUrl+' https://foreign.example/opaque'}:p)},{head:'b'.repeat(40)},{advanceDuringInventory:60001}]){
    const f=endpoint(name,{...config,...change});await f.run();assert.equal(f.mutations().length,0);assert.ok(f.res.statusCode>=400,JSON.stringify(f.res.body));
   }
  }finally{policy.distribution.reviewedEventExclusions=original;}
 });
 test(name+' uncertain creation and incomplete media receipts are held after exactly one mutation',async()=>{
  for(const change of [{mutationFailure:true},{missingAsset:true},{missingReceipt:true}]){const f=endpoint(name,change);await f.run();assert.equal(f.mutations().length,1);assert.equal(f.res.statusCode,202);assert.equal(f.res.body.status,'blocked');assert.equal(f.res.body.reconciliationRequired,true);assert.equal(JSON.stringify(f.res.body).includes('fixture timeout'),false);}
 });
}
