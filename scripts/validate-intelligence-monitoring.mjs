#!/usr/bin/env node
import fs from "node:fs";
const sources=JSON.parse(fs.readFileSync("automation/intelligence-sources.json","utf8"));
const ledger=JSON.parse(fs.readFileSync("automation/intelligence-signal-ledger.json","utf8"));
const state=JSON.parse(fs.readFileSync("automation/intelligence-monitoring-state.json","utf8"));
const scoring=JSON.parse(fs.readFileSync("automation/intelligence-scoring.json","utf8"));
let failures=0;const fail=m=>{console.error(m);failures++};const ids=new Set();
for(const s of sources.sources){
 if(ids.has(s.id))fail(`Duplicate source ${s.id}`);ids.add(s.id);
 for(const k of ["id","name","owner","type","url","priority","cadence","functions","technologies"])if(s[k]===undefined||s[k]===null||s[k]==="")fail(`${s.id||"source"} missing ${k}`);
 try{const u=new URL(s.url);if(u.protocol!=="https:")fail(`${s.id} must use HTTPS`)}catch{fail(`${s.id} invalid URL`)}
 if(!["high","medium","low"].includes(s.priority))fail(`${s.id} invalid priority`);
 if(!["hourly","daily","weekly"].includes(s.cadence))fail(`${s.id} invalid cadence`);
 if(!state.sourceState[s.id])fail(`Missing state for ${s.id}`);
}
const fingerprints=new Set();
for(const s of ledger.signals){if(!s.fingerprint)fail("Signal missing fingerprint");else if(fingerprints.has(s.fingerprint))fail(`Duplicate fingerprint ${s.fingerprint}`);else fingerprints.add(s.fingerprint);for(const k of ["detectedAt","sourceId","sourceUrl","decision","reason"])if(!s[k])fail(`${s.fingerprint||"signal"} missing ${k}`);if(!ids.has(s.sourceId))fail(`${s.fingerprint} unknown source`)}
const w=Object.values(scoring.weights).reduce((a,b)=>a+b,0);if(w!==100)fail(`Scoring weights total ${w}, expected 100`);
if(!(scoring.thresholds.trackerOnly<scoring.thresholds.alert&&scoring.thresholds.alert<scoring.thresholds.news))fail("Routing thresholds out of order");
if(!fs.existsSync("intelligence/changes.html"))fail("Missing public intelligence change log");
console.log(`Monitoring validation: ${sources.sources.length} sources, ${ledger.signals.length} fingerprints.`);
process.exitCode=failures?1:0;
