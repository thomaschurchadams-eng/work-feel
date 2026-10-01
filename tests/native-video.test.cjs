const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm'), path = require('node:path');
const { validateVideo, inspectPrefix, inspectPublicVideo, videoReceipt } = require('../lib/native-video.cjs');
const { validateSchedule, checkCapacity, mediaReady, selectSlot } = require('../lib/media-slots.cjs');
const policy = require('../automation/media-policy.json'), now = Date.parse('2026-10-05T12:00:00Z');
const video = { url: 'https://creditunionainews.com/assets/member-front-door-' + 'a'.repeat(12) + '.mp4', sha256: 'a'.repeat(64), mimeType: 'video/mp4', videoCodec: 'h264', bytes: 100000, durationSeconds: 73, width: 1280, height: 720, frameRate: 30, hasVideoTrack: true, probeVerified: true, burnedInCaptionsVerified: true };
function box(name, ...bodies) { const body = Buffer.concat(bodies), out = Buffer.alloc(8); out.writeUInt32BE(body.length + 8); out.write(name, 4); return Buffer.concat([out, body]); }
function mp4({ handler = 'vide', duration = 73, codec = 'avc1' } = {}) {
  const tkhd = Buffer.alloc(84); tkhd.writeUInt32BE(1280 * 65536, 76); tkhd.writeUInt32BE(720 * 65536, 80);
  const mdhd = Buffer.alloc(24); mdhd.writeUInt32BE(1000, 12); mdhd.writeUInt32BE(duration * 1000, 16);
  const hdlr = Buffer.alloc(20); hdlr.write(handler, 8);
  const stsd = Buffer.alloc(8); stsd.writeUInt32BE(1, 4);
  return Buffer.concat([box('ftyp', Buffer.from('isom0000')), box('moov', box('trak', box('tkhd', tkhd), box('mdia', box('mdhd', mdhd), box('hdlr', hdlr), box('minf', box('stbl', box('stsd', stsd, box(codec, Buffer.alloc(78), box('avcC', Buffer.from([1, 100, 0, 31, 255, 225, 0])))))))))]);
}
const headers = values => ({ get: k => values[k.toLowerCase()] || null });
function publicFetch({ mime = 'video/mp4', bytes = 100000, handler, duration, codec, pageOk = true } = {}) {
  return async (url, options) => {
    if (!url.endsWith('.mp4')) return { ok: pageOk, status: pageOk ? 200 : 404, headers: headers({'content-type':'text/html'}) };
    if (options?.method === 'HEAD') return { ok: true, headers: headers({'content-type':mime,'content-length':String(bytes)}) };
    return { ok: true, status: 206, headers: headers({'content-type':mime,'content-range':'bytes 0-99999/100000'}), arrayBuffer: async () => { const out=Buffer.alloc(bytes);mp4({handler,duration,codec}).copy(out);return out; } };
  };
}
test('native metadata and bounded public probe reject renamed audio, wrong MIME/size and mismatched duration', async () => {
  assert.equal(validateVideo(video), null); assert.equal((await inspectPublicVideo(video, publicFetch())).type, 'video');
  for (const opts of [{mime:'audio/mp4'}, {bytes:99999}, {handler:'soun'}, {duration:72}, {codec:'hvc1'}]) await assert.rejects(inspectPublicVideo(video, publicFetch(opts)));
  assert.throws(() => inspectPrefix(Buffer.from('not a video')), /metadata_missing/);
});
test('only stable same-host content-addressed H264 MP4 with validated caption/size/duration/rate is allowed', () => {
  for (const change of [{url:'https://other.example/file.mp4'}, {url:video.url+'?sig=x'}, {url:video.url+'#x'}, {url:video.url.replace('.mp4','.m4a')}, {url:video.url.replace('https:','http:')}, {mimeType:'video/quicktime'}, {hasVideoTrack:false}, {probeVerified:false}, {bytes:1000000001}, {bytes:74999}, {durationSeconds:2.9}, {durationSeconds:1801}, {videoCodec:'prores'}, {width:1920}, {frameRate:61}, {burnedInCaptionsVerified:false}, {sha256:'b'.repeat(64)}]) assert.ok(validateVideo({...video,...change}),JSON.stringify(change));
});
function endpoint({ duplicate, post = {id:'video-post',status:'scheduled',assets:[{mimeType:'video/mp4',source:'https://buffer.example/transcoded.mp4'}]}, conflict=false, weeklyConflict=false, truncated=false, changes={}, transportFailure=false, publicOptions={} }={}) {
  const asset = { id:'video-oct8',format:'short-video',targetDate:'2026-10-06',status:'published',preparedAt:'2026-10-02T16:00:00Z',sourceVerified:true,sourceURLs:['https://www.filene.org/reports/the-new-money-movement-landscape'],rightsVerified:true,accessibilityVerified:true,productionVerified:true,canonicalUrl:'https://creditunionainews.com/episodes/video.html',transcriptUrl:'https://creditunionainews.com/episodes/video.html',thumbnailUrl:'https://creditunionainews.com/assets/video-preview.png',altText:'Video summary',distributionMode:'native-video',nativeVideo:video };
  const item = {id:'linkedin-video',platform:'linkedin',status:'queued',scheduledFor:'2026-10-06T11:30:00-04:00',contentKind:'media',mediaAssetId:asset.id,mediaFormat:'short-video',mediaType:'video',articleUrl:asset.canonicalUrl,distributionUrl:asset.canonicalUrl,copy:'A useful original CUAI video '+asset.canonicalUrl,imageUrl:asset.thumbnailUrl,imageAlt:asset.altText,videoUrl:video.url,videoSha256:video.sha256,...changes};
  const calls=[], module={exports:{}};
  vm.runInNewContext(fs.readFileSync(require.resolve('../api/buffer-schedule-image.js'),'utf8'),{module,URL,Date,Intl,Set,AbortSignal,process:{cwd:()=>'/fixture',env:{BUFFER_API_KEY:'fixture-only',VERCEL_GIT_COMMIT_SHA:'fixture'}},require:p=>p.endsWith('operations-auth')?{authorize:async()=>true}:p==='node:path'?path:p==='node:fs'?{readFileSync:p=>JSON.stringify(p.endsWith('social-queue.json')?{items:[item]}:{assets:[asset]})}:p.endsWith('media-policy.json')?policy:p.endsWith('native-video.cjs')?{validateVideo,inspectPublicVideo:v=>inspectPublicVideo(v,publicFetch(publicOptions)),videoReceipt}:p.endsWith('media-slots.cjs')?{validateSchedule:(raw,item)=>validateSchedule(raw,item,policy,now),checkCapacity,mediaReady:(asset,date)=>mediaReady(asset,date,now)}:(()=>{throw Error('unexpected require')})(),fetch:async(url,options)=>{
    if(url!=='https://api.buffer.com')return publicFetch(publicOptions)(url,options);
    const b=JSON.parse(options.body);calls.push(b);
    if(b.query.includes('createPost')){if(transportFailure)throw Error('ambiguous transport');return{ok:true,json:async()=>({data:{createPost:post?{post}:{message:'rejected'}}})};}
    const data=b.query.includes('channels(')?{channels:[{id:policy.distribution.channelId,displayName:'CreditUnionAI News',service:'linkedin',isQueuePaused:false}]}:b.query.includes('posts(')?{posts:{pageInfo:{hasNextPage:truncated},edges:weeklyConflict?Array.from({length:5},(_,i)=>({node:{id:'weekly-'+i,status:'sent',sentAt:'2026-10-05T16:00:00Z',text:'Other '+i}})):duplicate?[{node:{...duplicate,text:item.copy}}]:conflict?[{node:{id:'other',status:'scheduled',dueAt:'2026-10-06T15:30:00Z',text:'Other'}}]:[]}}:{account:{organizations:[{id:'org'}]}};
    return{ok:true,json:async()=>({data})};
  }});
  const res={setHeader(){},status(code){this.statusCode=code;return this;},json(body){this.body=body;return this;}};
  return{run:()=>module.exports({method:'POST',body:{itemId:item.id,commitSha:'fixture'}},res),res,calls};
}
test('native payload contains exactly one video URL and no unsupported thumbnail, SRT or link attachment',async()=>{
  const f=endpoint();await f.run();assert.equal(f.res.statusCode,201);assert.equal(f.res.body.videoAttached,true);assert.equal(f.res.body.postId,'video-post');
  const input=f.calls.find(c=>c.query.includes('createPost')).variables.input;assert.deepEqual(JSON.parse(JSON.stringify(input.assets)),[{video:{url:video.url}}]);assert.equal(input.metadata,undefined);assert.equal(input.channelId,policy.distribution.channelId);
});
test('duplicate video receipt reconciles without creating another post; wrong-type duplicate stays blocked',async()=>{
  for(const duplicate of [{id:'existing',status:'scheduled',assets:[{mimeType:'video/mp4'}]},{id:'existing',status:'scheduled',assets:[{mimeType:'image/png'}]},{id:'mixed',status:'scheduled',assets:[{mimeType:'video/mp4'},{mimeType:'image/png'}]}]){const f=endpoint({duplicate});await f.run();assert.equal(f.calls.some(c=>c.query.includes('createPost')),false);assert.equal(f.res.body.postId,duplicate.id);assert.equal(f.res.body.ok,duplicate.assets.length===1&&duplicate.assets[0].mimeType==='video/mp4');}
});
test('processing, error, rejection and unknown outcomes retain blocked reconciliation receipts without retry',async()=>{
  for(const cfg of [{post:{id:'wrong-time',status:'scheduled',dueAt:'2026-10-07T15:30:00Z',assets:[{mimeType:'video/mp4'}]}},{post:{id:'pending',status:'scheduled',assets:[]}},{post:{id:'failed',status:'error',assets:[]}},{post:null},{transportFailure:true},{post:{status:'scheduled',assets:[{mimeType:'video/mp4'}]}}]){
    const f=endpoint(cfg);await f.run();assert.equal(f.res.statusCode,202);assert.equal(f.res.body.status,'blocked');assert.equal(f.res.body.ok,false);assert.equal(f.res.body.reconciliationRequired,true);assert.equal(f.calls.filter(c=>c.query.includes('createPost')).length,1);
    if(cfg.post?.id)assert.equal(f.res.body.postId,cfg.post.id);
  }
});
test('caps, truncated inventory, altered manifest hash and public-media failures stop before mutation',async()=>{
  for(const cfg of [{conflict:true},{weeklyConflict:true},{truncated:true},{changes:{videoSha256:'b'.repeat(64)}},{changes:{mediaFormat:'podcast'}},{publicOptions:{handler:'soun'}},{publicOptions:{mime:'audio/mp4'}},{publicOptions:{pageOk:false}}]){
    const f=endpoint(cfg);await f.run();assert.ok(f.res.statusCode>=400);assert.equal(f.calls.some(c=>c.query.includes('createPost')),false);
  }
});

test('planned native assets require a finished package; redirects, truncated bytes and false range totals fail closed',async()=>{
 const asset={id:'planned',format:'short-video',targetDate:'2026-10-06',status:'published',preparedAt:'2026-10-02T16:00:00Z',sourceVerified:true,sourceURLs:['https://www.filene.org/reports/the-new-money-movement-landscape'],rightsVerified:true,accessibilityVerified:true,productionVerified:true,canonicalUrl:'https://creditunionainews.com/episodes/video.html',transcriptUrl:'https://creditunionainews.com/episodes/video.html',thumbnailUrl:'https://creditunionainews.com/assets/preview.png',distributionMode:'native-video',nativeVideo:null};
 assert.equal(mediaReady(asset,asset.targetDate,now),false);assert.equal(mediaReady({...asset,nativeVideo:video},asset.targetDate,now),true);
 for(const fault of ['redirect','short','range'])await assert.rejects(inspectPublicVideo(video,async(url,options)=>{
  assert.equal(options.redirect,'error');
  if(fault==='redirect')throw Error('redirect refused');
  const r=await publicFetch()(url,options);if(options.method==='HEAD')return r;
  if(fault==='short')r.arrayBuffer=async()=>mp4();
  if(fault==='range')r.headers=headers({'content-type':'video/mp4','content-range':'bytes 0-100/100000'});
  return r;
 }));
});

test('native packages cannot downgrade to image requests or promote a mismatched planned reservation',async()=>{
 for(const mediaType of [undefined,'image']){const f=endpoint({changes:{mediaType}});await f.run();assert.equal(f.res.statusCode,400);assert.equal(f.res.body.error,'native_video_required');assert.equal(f.calls.length,0);}
 const asset={id:'planned',format:'short-video',targetDate:'2026-10-06',status:'published',preparedAt:'2026-10-02T16:00:00Z',sourceVerified:true,sourceURLs:['https://www.filene.org/reports/the-new-money-movement-landscape'],rightsVerified:true,accessibilityVerified:true,productionVerified:true,canonicalUrl:'https://creditunionainews.com/episodes/video.html',transcriptUrl:'https://creditunionainews.com/episodes/video.html',thumbnailUrl:'https://creditunionainews.com/assets/preview.png',altText:'Preview',distributionMode:'native-video',nativeVideo:video};
 const item={id:'reserved',platform:'linkedin',status:'planned',scheduledFor:'2026-10-06T11:30:00-04:00',contentKind:'media',mediaAssetId:asset.id,articleUrl:asset.canonicalUrl,imageUrl:asset.thumbnailUrl,imageAlt:asset.altText,mediaFormat:asset.format};
 assert.equal(selectSlot({date:asset.targetDate,queue:[item],media:[asset],now}).status,'reserved');
 assert.equal(selectSlot({date:asset.targetDate,queue:[{...item,mediaType:'video',videoUrl:video.url,videoSha256:video.sha256}],media:[asset],now}).status,'ready-to-queue');
});
