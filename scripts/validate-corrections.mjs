#!/usr/bin/env node
import fs from "node:fs";
const policy=JSON.parse(fs.readFileSync("automation/corrections-policy.json","utf8"));
const ledger=JSON.parse(fs.readFileSync("automation/corrections-ledger.json","utf8"));
const health=JSON.parse(fs.readFileSync("automation/source-health.json","utf8"));
let failures=0;const fail=m=>{console.error(m);failures++};const ids=new Set();const allowed=policy.noticeMarkup.allowedTypes;
const corrections=fs.readFileSync("corrections.html","utf8");
const publicRecord=corrections.split("<!-- CORRECTIONS_LEDGER_START -->")[1]?.split("<!-- CORRECTIONS_LEDGER_END -->")[0]??"";
for(const e of ledger.entries){
 for(const k of ["id","articlePath","articleUrl","type","publishedAt","summary","trigger","sources"])if(e[k]===undefined||e[k]===null||e[k]==="")fail(`${e.id||"entry"} missing ${k}`);
 if(ids.has(e.id))fail(`Duplicate correction id ${e.id}`);ids.add(e.id);
 if(!allowed.includes(e.type))fail(`${e.id} invalid type`);
 if(!fs.existsSync(e.articlePath))fail(`${e.id} missing article ${e.articlePath}`);
 const html=fs.readFileSync(e.articlePath,"utf8");
 if(e.noticeLocation==="public-correction-record"){
  const card=publicRecord.split(`<div class="card" id="${e.id}">`)[1]?.split("</div>")[0]??"";
  if(e.id!=="vantage-west-ai-navigator-headline-2026-11-25"||e.type!=="correction"||!card.includes("<time ")||!card.includes(`href="/${e.articlePath}"`)||!e.sources.some(u=>card.includes(`href="${u}"`)))fail(`${e.id} missing approved public correction record`);
 }else if(e.noticeLocation!==undefined||!html.includes(`data-correction-type="${e.type}"`))fail(`${e.id} missing visible article notice`);
 if(!/article:modified_time|dateModified/.test(html))fail(`${e.id} missing modified metadata`);
 for(const u of e.sources)try{const x=new URL(u);if(x.protocol!=="https:")fail(`${e.id} non-HTTPS source`)}catch{fail(`${e.id} invalid source`)}
}
const sourceKeys=new Set();
for(const s of health.sources){
 for(const k of ["url","status","lastChecked","articlePaths"])if(s[k]===undefined||s[k]===null||s[k]==="")fail(`Source health entry missing ${k}`);
 if(sourceKeys.has(s.url))fail(`Duplicate source health URL ${s.url}`);sourceKeys.add(s.url);
 if(!policy.sourceHealthStatuses.includes(s.status))fail(`${s.url} invalid health status`);
}
if(!fs.existsSync("corrections.html"))fail("Missing public corrections page");
if(!corrections.includes("CORRECTIONS_LEDGER_START")||!corrections.includes("CORRECTIONS_LEDGER_END"))fail("Corrections page missing ledger markers");
console.log(`Corrections validation: ${ledger.entries.length} public entries, ${health.sources.length} monitored URLs.`);
process.exitCode=failures?1:0;
