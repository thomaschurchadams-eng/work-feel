#!/usr/bin/env node
import fs from "node:fs";
const config=JSON.parse(fs.readFileSync("automation/topic-hubs.json","utf8"));
const required=["id","type","label","description","function","technology","articles"];
let failed=false;
for(const hub of config.hubs){
 for(const key of required) if(!hub[key]){console.error(`Missing ${key} on hub ${hub.id||"(unknown)"}`);failed=true;}
 if(hub.articles.length<config.minimumArticles){console.error(`Thin hub ${hub.id}: ${hub.articles.length} articles`);failed=true;}
 for(const article of hub.articles) if(!fs.existsSync(article.path)){console.error(`Missing article ${article.path} referenced by ${hub.id}`);failed=true;}
 const output=`topics/${hub.id}.html`;
 if(!fs.existsSync(output)){console.error(`Missing generated hub ${output}`);failed=true;}
}
console.log(`Topic hub audit: ${config.hubs.length} hubs, ${config.hubs.reduce((n,h)=>n+h.articles.length,0)} article placements.`);
if(failed) process.exitCode=1;
