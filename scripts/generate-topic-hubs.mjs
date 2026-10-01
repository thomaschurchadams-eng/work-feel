#!/usr/bin/env node
import fs from "node:fs";

const config=JSON.parse(fs.readFileSync("automation/topic-hubs.json","utf8"));
const checkOnly=process.argv.includes("--check");
const required=["id","type","label","description","function","technology","articles"];
let failed=false;
const home=fs.readFileSync("index.html","utf8");
const nav=home.match(/<header class="site-header">[\s\S]*?<\/header>/)[0];
const footer=home.match(/<footer class="footer">[\s\S]*?<\/footer>/)[0]+'<script src="/assets/app.js"></script>';
const escape=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');


function render(hub){
 const related=config.hubs.filter(other=>other.id!==hub.id && ["payments","core-digital-banking","vendors-partners"].includes(other.id)).map(other=>`<a class="link" href="/topics/${other.id}.html">${escape(other.label)}</a>`).join(" · ");
 const canonical=`${config.baseUrl}/topics/${hub.id}.html`;
 const items=hub.articles.map(article=>`<article class="card"><span class="label-tag">${hub.type==="function"?"Credit Union Function":"Technology"}</span><h2><a href="../${article.path}">${escape(article.title)}</a></h2><p>${escape(article.summary)}</p><a class="link" href="../${article.path}">Read coverage →</a></article>`).join("\n");
 const list=hub.articles.map((article,index)=>JSON.stringify({"@type":"ListItem",position:index+1,url:`${config.baseUrl}/${article.path}`,name:article.title}));
 const schema=JSON.stringify({"@context":"https://schema.org","@type":"CollectionPage",name:hub.label,description:hub.description,url:canonical,mainEntity:{"@type":"ItemList",itemListElement:list.map(JSON.parse)}});
 return `<!DOCTYPE html><html lang="en"><head><script async src="https://www.googletagmanager.com/gtag/js?id=G-RF6EFK06G5"></script><script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','G-RF6EFK06G5');</script><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(hub.label)} | CreditUnionAI News</title><meta name="description" content="${escape(hub.description)}"><link rel="canonical" href="${canonical}"><meta property="og:type" content="website"><meta property="og:title" content="${escape(hub.label)}"><meta property="og:description" content="${escape(hub.description)}"><meta property="og:url" content="${canonical}"><meta property="og:image" content="${config.baseUrl}/assets/download.png"><meta name="twitter:card" content="summary"><script type="application/ld+json">${schema}</script><link rel="stylesheet" href="../assets/styles.css"></head><body data-section="topics" data-editorial-function="${hub.function}" data-technology="${hub.technology}" data-content-format="topic-hub" data-audience="functional-leader" data-maturity="all"><a class="skip-link" href="#main-content">Skip to content</a>${nav}<main id="main-content"><section class="section"><div class="container"><a class="link" href="../topics.html">← All topics</a><div style="max-width:850px;margin:28px 0 34px"><span class="label-tag">${hub.type==="function"?"Credit Union Function":"Technology Theme"}</span><h1>${escape(hub.label)}</h1><p class="article-summary">${escape(hub.description)}</p></div><div class="card-grid">${items}</div><p>Related industry paths: ${related}</p><div class="card" style="margin-top:32px"><h2>Stay current on ${escape(hub.label)}</h2><p>Explore published CUAI Weekly web briefings and their sources.</p><a class="button" href="../newsletter.html">Browse web briefings</a></div></div></section></main>${footer}</body></html>`;
}

for(const hub of config.hubs){
 for(const key of required) if(!hub[key]){console.error(`Missing ${key} on hub ${hub.id||"(unknown)"}`);failed=true;}
 if(!hub.articles||hub.articles.length<config.minimumArticles){console.error(`Thin hub ${hub.id}`);failed=true;continue;}
 for(const article of hub.articles) if(!fs.existsSync(article.path)){console.error(`Missing article ${article.path} referenced by ${hub.id}`);failed=true;}
 const output=`topics/${hub.id}.html`, rendered=render(hub);
 if(checkOnly){
  if(!fs.existsSync(output)||fs.readFileSync(output,"utf8")!==rendered){console.error(`Stale generated hub ${output}`);failed=true;}
 }else{
  fs.mkdirSync("topics",{recursive:true});
  fs.writeFileSync(output,rendered);
 }
}
console.log(`Topic hubs ${checkOnly?"checked":"generated"}: ${config.hubs.length} hubs, ${config.hubs.reduce((n,h)=>n+h.articles.length,0)} article placements.`);
if(failed) process.exitCode=1;
