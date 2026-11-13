#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
const schema=JSON.parse(fs.readFileSync("automation/intelligence-schema.json","utf8"));
const vendors=JSON.parse(fs.readFileSync("automation/vendor-registry.json","utf8"));
const regulatory=JSON.parse(fs.readFileSync("automation/regulatory-watch.json","utf8"));
let failures=0;
const iso=/^\d{4}-\d{2}-\d{2}$/;
function fail(msg){console.error(msg);failures++}
function url(value,label){try{const u=new URL(value);if(u.protocol!=="https:")fail(`${label} must use HTTPS`)}catch{fail(`${label} is invalid`)}}
function coverage(signal,label){
 if(signal.relatedCoverage===undefined){if(signal.coverageStatus!=="tracker-only-no-article")fail(`${label} needs coverage or explicit tracker-only-no-article status`);return}
 const value=signal.relatedCoverage;
 if(typeof value!=="string"||! /^(?:news\/[a-z0-9-]+|insight-[a-z0-9-]+|alerts\/index)\.html$/.test(value)){fail(`${label} invalid local coverage path`);return}
 const resolved=path.resolve(value);
 if(!fs.existsSync(resolved)||!fs.statSync(resolved).isFile())fail(`${label} missing coverage ${value}`);
}
function readerCopy(signal,label,visible=false){
 if(signal.publicSummary!==undefined && (typeof signal.publicSummary!=="string"||!signal.publicSummary.trim()))fail(`${label} invalid publicSummary`);
 const text=signal.publicSummary??signal.summary;
 if(visible && /tracker initialized|existing (?:newsroom )?(?:coverage|reporting|analysis) (?:tracks|of|on)/i.test(text))fail(`${label} public summary contains internal process narration`);
}
function date(value,label){const parsed=new Date(value);if(!iso.test(value)||!Number.isFinite(parsed.getTime())||parsed.toISOString().slice(0,10)!==value)fail(`${label} invalid date`)}
const vendorIds=new Set();
for(const v of vendors.vendors){
 for(const key of schema.recordTypes.vendor.required) if(v[key]===undefined||v[key]===null||v[key]==="")fail(`${v.id||"vendor"} missing ${key}`);
 if(vendorIds.has(v.id))fail(`Duplicate vendor ${v.id}`);vendorIds.add(v.id);
 date(v.lastReviewed,`${v.id} lastReviewed`);
 if(!Array.isArray(v.signals)||!v.signals.length)fail(`${v.id} requires a signal`);
 for(const s of v.signals||[]){
  for(const key of schema.recordTypes.vendor.signalRequired)if(!s[key])fail(`${v.id} signal missing ${key}`);
  if(!schema.recordTypes.vendor.allowedSignalTypes.includes(s.type))fail(`${v.id} invalid signal type`);
  if(!schema.recordTypes.vendor.allowedEvidenceLevels.includes(s.evidenceLevel))fail(`${v.id} invalid evidence level`);
  readerCopy(s,v.id,s===v.signals[0]&&!v.promotionStatus?.startsWith("withheld"));
  date(s.date,`${v.id} signal`);url(s.sourceUrl,`${v.id} source`);coverage(s,v.id);
 }
}
const regIds=new Set();
for(const r of regulatory.records){
 for(const key of schema.recordTypes.regulatory.required)if(r[key]===undefined||r[key]===null||r[key]==="")fail(`${r.id||"regulatory"} missing ${key}`);
 if(regIds.has(r.id))fail(`Duplicate regulatory record ${r.id}`);regIds.add(r.id);
 date(r.lastReviewed,`${r.id} lastReviewed`);
 if(!Array.isArray(r.developments)||!r.developments.length)fail(`${r.id} requires a development`);
 for(const d of r.developments||[]){
  for(const key of schema.recordTypes.regulatory.developmentRequired)if(!d[key])fail(`${r.id} development missing ${key}`);
  if(!schema.recordTypes.regulatory.allowedTypes.includes(d.type))fail(`${r.id} invalid development type`);
  if(!schema.recordTypes.regulatory.allowedStatuses.includes(d.status))fail(`${r.id} invalid status`);
  readerCopy(d,r.id,d===r.developments.at(-1));
  date(d.date,`${r.id} development`);url(d.sourceUrl,`${r.id} source`);coverage(d,r.id);
 }
}
for(const path of ["intelligence/index.html","intelligence/vendors.html","intelligence/regulatory-watch.html"])if(!fs.existsSync(path))fail(`Missing public page ${path}`);
console.log(`Intelligence validation: ${vendors.vendors.length} vendors, ${regulatory.records.length} regulatory records.`);
process.exitCode=failures?1:0;
