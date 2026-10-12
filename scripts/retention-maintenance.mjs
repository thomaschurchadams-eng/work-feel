#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const apply=process.argv.includes('--apply');
const now=new Date();
const policy=JSON.parse(fs.readFileSync(path.join(root,'automation/retention-policy.json'),'utf8'));
const ledgerPath=path.join(root,'automation/asset-retention-ledger.json');
const reportPath=path.join(root,policy.reporting.writePath);
const ledger=JSON.parse(fs.readFileSync(ledgerPath,'utf8'));
const ignored=new Set(['.git','node_modules','.vercel']);
const textExtensions=new Set(['.html','.css','.js','.mjs','.json','.md','.xml','.txt']);
const assetExtensions=new Set(policy.assets.extensions);
const neverDelete=new Set(policy.safety.neverDeletePaths.map(p=>p.replaceAll('\\','/')));
const files=[];

function walk(dir){
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    if(ignored.has(entry.name)) continue;
    const full=path.join(dir,entry.name);
    if(entry.isDirectory()) walk(full); else files.push(full);
  }
}
walk(root);
const relative=p=>path.relative(root,p).replaceAll('\\','/');
const text=files.filter(f=>textExtensions.has(path.extname(f).toLowerCase()))
  .map(f=>({path:relative(f),content:fs.readFileSync(f,'utf8')}));
const assets=files.filter(f=>assetExtensions.has(path.extname(f).toLowerCase()));
const newOrphans=[],deletedAssets=[],oversizedAssets=[],blockedDeletions=[];
const graceMs=policy.assets.orphanGraceDays*86400000;

function referenced(asset){
  const rel=relative(asset);
  const base=path.basename(asset);
  return text.some(doc=>doc.path!==rel && (doc.content.includes(rel)||doc.content.includes('/'+rel)||doc.content.includes(base)));
}
for(const asset of assets){
  const rel=relative(asset);
  const size=fs.statSync(asset).size;
  if(size>policy.assets.maximumRecommendedBytes) oversizedAssets.push({path:rel,bytes:size});
  if(referenced(asset)){
    delete ledger.assets[rel];
    continue;
  }
  if(neverDelete.has(rel)){
    blockedDeletions.push({path:rel,reason:'protected path'});
    continue;
  }
  const record=ledger.assets[rel];
  if(!record){
    ledger.assets[rel]={firstSeenOrphanAt:now.toISOString(),lastSeenOrphanAt:now.toISOString(),bytes:size};
    newOrphans.push(rel);
    continue;
  }
  record.lastSeenOrphanAt=now.toISOString();
  record.bytes=size;
  if(now-new Date(record.firstSeenOrphanAt)>=graceMs){
    if(apply){
      fs.unlinkSync(asset);
      deletedAssets.push(rel);
      delete ledger.assets[rel];
    }
  }
}
for(const rel of Object.keys(ledger.assets)){
  if(!fs.existsSync(path.join(root,rel))) delete ledger.assets[rel];
}
ledger.lastAuditAt=now.toISOString();
if(apply) ledger.lastAppliedAt=now.toISOString();
const report={
  version:1,generatedAt:now.toISOString(),mode:apply?'autonomous-apply':'audit',
  scannedAssets:assets.length,newOrphans,deletedAssets,oversizedAssets,blockedDeletions,
  contentActions:[],branchActions:[],deploymentActions:[],
  status:'completed'
};
fs.writeFileSync(ledgerPath,JSON.stringify(ledger,null,2)+'\n');
fs.writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
