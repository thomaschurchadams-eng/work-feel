const { createPublicKey, verify } = require('node:crypto');
const ISSUER = 'https://token.actions.githubusercontent.com';
const AUDIENCE = 'https://creditunionainews.com/operations';
const REPOSITORY = 'thomaschurchadams-eng/work-feel';
const REPOSITORY_ID = '1086718496';
const OWNER_ID = '241192016';
const WORKFLOW = REPOSITORY + '/.github/workflows/cuai-operations.yml@refs/heads/main';
let cached = null;
async function keys() {
  if (cached && cached.expires > Date.now()) return cached.keys;
  const response = await fetch(ISSUER + '/.well-known/jwks', { redirect:'error', signal:AbortSignal.timeout(5000) });
  if (!response.ok) throw Error('identity_keys_unavailable');
  const text = await response.text();
  if (text.length > 100000) throw Error('identity_keys_invalid');
  const value = JSON.parse(text);
  if (!Array.isArray(value.keys)) throw Error('identity_keys_invalid');
  cached = {keys:value.keys,expires:Date.now()+3600000}; return value.keys;
}
async function verifyToken(token, getKeys=keys, now=Math.floor(Date.now()/1000)) {
  if (typeof token !== 'string' || token.length > 12000 || !/^[\w-]+\.[\w-]+\.[\w-]+$/.test(token)) throw Error('unauthorized');
  const parts=token.split('.');let header,claims;
  try {header=JSON.parse(Buffer.from(parts[0],'base64url'));claims=JSON.parse(Buffer.from(parts[1],'base64url'));}catch{throw Error('unauthorized');}
  if (header.alg !== 'RS256' || !header.kid || (header.typ && header.typ !== 'JWT')) throw Error('unauthorized');
  const key=(await getKeys()).find(k=>k.kid===header.kid&&k.kty==='RSA'&&(!k.alg||k.alg==='RS256')&&(!k.use||k.use==='sig'));
  if (!key || !verify('RSA-SHA256',Buffer.from(parts[0]+'.'+parts[1]),createPublicKey({key,format:'jwk'}),Buffer.from(parts[2],'base64url'))) throw Error('unauthorized');
  const subjects=[`repo:${REPOSITORY}:ref:refs/heads/main`,`repo:thomaschurchadams-eng@${OWNER_ID}/work-feel@${REPOSITORY_ID}:ref:refs/heads/main`];
  if (claims.iss!==ISSUER || claims.aud!==AUDIENCE || !subjects.includes(claims.sub) || claims.repository!==REPOSITORY || String(claims.repository_id)!==REPOSITORY_ID || String(claims.repository_owner_id)!==OWNER_ID || claims.ref!=='refs/heads/main' || claims.workflow_ref!==WORKFLOW || claims.runner_environment!=='github-hosted' || !['deployment_status','workflow_dispatch'].includes(claims.event_name)) throw Error('unauthorized');
  if (![claims.exp,claims.iat,claims.nbf].every(Number.isFinite) || claims.exp<=now || claims.iat>now+15 || claims.nbf>now+15 || claims.exp-claims.iat>600 || claims.iat<now-600) throw Error('unauthorized');
  return {runId:String(claims.run_id),repository:REPOSITORY};
}
async function authorize(req,res) {
  const token=typeof req.headers?.authorization==='string'&&req.headers.authorization.startsWith('Bearer ')?req.headers.authorization.slice(7):'';
  try {await verifyToken(token);return true;}catch(error){
    res.setHeader('Cache-Control','no-store');res.status(error.message.startsWith('identity_keys_')?503:401).json({ok:false,error:error.message.startsWith('identity_keys_')?'identity_temporarily_unavailable':'unauthorized'});return false;
  }
}
module.exports={authorize,verifyToken,AUDIENCE};
