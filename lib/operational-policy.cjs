// Resolves existing controlling sources; never claims perceptual or live acceptance.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const roles=Object.freeze({'daily-publisher':'publish-cuai-daily-article.md','cuai-operating-system':'cuai-operating-system.md','cuai-media-coordinator':'cuai-media-coordinator.md'});
function resolvePolicy(role,root=path.resolve(__dirname,'..')){
 if(!Object.hasOwn(roles,role))throw Error('unknown-operational-role');
 const paths=['automation/scheduled-tasks/README.md','automation/agent-system/CUAI_AGENT_PROTOCOL.md','automation/scheduled-tasks/'+roles[role]];
 if(role==='cuai-media-coordinator')paths.push('automation/native-video-handoff.md');
 const canonicalRoot=fs.realpathSync(root);
 const sources=paths.map(file=>{
  const p=path.join(canonicalRoot,file);let bytes;
  try{if(fs.realpathSync(p)!==p)throw Error('shadowed-policy');bytes=fs.readFileSync(p);}catch(e){throw Error('controlling-policy-unavailable:'+file+':'+e.message);}
  if(!bytes.length)throw Error('empty-controlling-policy:'+file);
  if((file.endsWith(roles[role])||file.endsWith('CUAI_AGENT_PROTOCOL.md'))&&!bytes.includes(Buffer.from('<!-- cuai-cycle-acceptance-v1 -->')))throw Error('cycle-acceptance-missing:'+file);
  return {path:file,sha256:crypto.createHash('sha256').update(bytes).digest('hex')};
 });
 return {role,sources,scope:'checked-out-policy-resolution-only',scheduledActivationVerified:false,endUserReviewVerified:false,liveDeliveryVerified:false};
}
module.exports={resolvePolicy};
