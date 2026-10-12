#!/usr/bin/env node
import fs from "node:fs";
const policy=JSON.parse(fs.readFileSync("automation/corrections-policy.json","utf8"));
const files=fs.readdirSync("news").filter(x=>x.endsWith(".html")&&x!=="article-template.html").map(x=>`news/${x}`).concat(fs.readdirSync(".").filter(x=>/^insight-.*\.html$/.test(x)));
let links=0,missingCanonical=0,missingDate=0,notices=0;
for(const path of files){const html=fs.readFileSync(path,"utf8");links+=(html.match(/href=["']https:\/\//g)||[]).length;if(!/<link[^>]+rel=["']canonical["']/i.test(html)){console.error(`Missing canonical: ${path}`);missingCanonical++}if(!/article:published_time|datePublished|<time[^>]+datetime=/i.test(html)){console.error(`Missing publication date: ${path}`);missingDate++}if(/data-correction-type=/.test(html))notices++}
console.log(`Trust audit: ${files.length} articles, ${links} external evidence links, ${notices} visible notices.`);
if(missingCanonical||missingDate)process.exitCode=1;
