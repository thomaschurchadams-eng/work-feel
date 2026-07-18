#!/usr/bin/env node
import fs from "node:fs";

const ledger=JSON.parse(fs.readFileSync("automation/legacy-migration.json","utf8"));
let failures=0;
for(const item of ledger.articles){
  if(!fs.existsSync(item.path)){ console.error(`MISSING ${item.path}`); failures++; continue; }
  const html=fs.readFileSync(item.path,"utf8");
  const checks={
    canonical:/<link[^>]+rel=["']canonical["']/i.test(html),
    description:/<meta[^>]+name=["']description["']/i.test(html),
    analytics:/<body[^>]+data-section=/i.test(html),
    structuredData:/<script[^>]+application\/ld\+json/i.test(html),
    byline:/article-byline/i.test(html),
    dated:/<time[^>]+datetime=/i.test(html),
    internalLinks:(html.match(/href=["'](?:\.\.\/|\/|[a-z0-9-]+\.html)/gi)||[]).length>=3
  };
  const missing=Object.entries(checks).filter(([,ok])=>!ok).map(([name])=>name);
  if(missing.length) console.log(`${item.status.toUpperCase()} ${item.path}: ${missing.join(", ")}`);
}
const completed=ledger.articles.filter(x=>x.status==="completed").length;
if(completed!==ledger.summary.completed){console.error("Ledger summary mismatch");failures++;}
console.log(`Migration audit: ${completed}/${ledger.articles.length} completed.`);
process.exitCode=failures?1:0;
