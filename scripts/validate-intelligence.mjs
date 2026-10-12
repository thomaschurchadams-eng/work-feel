#!/usr/bin/env node
import fs from "node:fs";
const schema=JSON.parse(fs.readFileSync("automation/intelligence-schema.json","utf8"));
const vendors=JSON.parse(fs.readFileSync("automation/vendor-registry.json","utf8"));
const regulatory=JSON.parse(fs.readFileSync("automation/regulatory-watch.json","utf8"));
let failures=0;
const iso=/^\d{4}-\d{2}-\d{2}$/;
function fail(msg){console.error(msg);failures++}
function url(value,label){try{const u=new URL(value);if(u.protocol!=="https:")fail(`${label} must use HTTPS`)}catch{fail(`${label} is invalid`)}}
const vendorIds=new Set();
for(const v of vendors.vendors){
 for(const key of schema.recordTypes.vendor.required) if(v[key]===undefined||v[key]===null||v[key]==="")fail(`${v.id||"vendor"} missing ${key}`);
 if(vendorIds.has(v.id))fail(`Duplicate vendor ${v.id}`);vendorIds.add(v.id);
 if(!iso.test(v.lastReviewed))fail(`${v.id} invalid lastReviewed`);
 for(const s of v.signals||[]){
  for(const key of schema.recordTypes.vendor.signalRequired)if(!s[key])fail(`${v.id} signal missing ${key}`);
  if(!schema.recordTypes.vendor.allowedSignalTypes.includes(s.type))fail(`${v.id} invalid signal type`);
  if(!schema.recordTypes.vendor.allowedEvidenceLevels.includes(s.evidenceLevel))fail(`${v.id} invalid evidence level`);
  url(s.sourceUrl,`${v.id} source`);if(!fs.existsSync(s.relatedCoverage))fail(`${v.id} missing coverage ${s.relatedCoverage}`);
 }
}
const regIds=new Set();
for(const r of regulatory.records){
 for(const key of schema.recordTypes.regulatory.required)if(r[key]===undefined||r[key]===null||r[key]==="")fail(`${r.id||"regulatory"} missing ${key}`);
 if(regIds.has(r.id))fail(`Duplicate regulatory record ${r.id}`);regIds.add(r.id);
 for(const d of r.developments||[]){
  for(const key of schema.recordTypes.regulatory.developmentRequired)if(!d[key])fail(`${r.id} development missing ${key}`);
  if(!schema.recordTypes.regulatory.allowedTypes.includes(d.type))fail(`${r.id} invalid development type`);
  if(!schema.recordTypes.regulatory.allowedStatuses.includes(d.status))fail(`${r.id} invalid status`);
  url(d.sourceUrl,`${r.id} source`);if(!fs.existsSync(d.relatedCoverage))fail(`${r.id} missing coverage ${d.relatedCoverage}`);
 }
}
for(const path of ["intelligence/index.html","intelligence/vendors.html","intelligence/regulatory-watch.html"])if(!fs.existsSync(path))fail(`Missing public page ${path}`);
console.log(`Intelligence validation: ${vendors.vendors.length} vendors, ${regulatory.records.length} regulatory records.`);
process.exitCode=failures?1:0;
